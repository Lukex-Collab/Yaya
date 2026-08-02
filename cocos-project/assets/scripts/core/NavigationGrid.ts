import { Vec3 } from 'cc';
import { CHUNK_WORLD_SIZE } from './Constants';

/**
 * 等距网格 A* 寻路 — 2.5D 世界不需要 NavMesh。
 *
 * 网格分辨率 = 1m/tile。
 * 障碍 = 建筑/岩石/水体/崖壁（从 chunk 碰撞数据提取）。
 *
 * 分层 A*：
 *   - chunk 间：预计算连接图（区域路径网络）
 *   - chunk 内：网格 A*
 */

// 8 方向
const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
];

interface AStarNode {
    x: number;
    z: number;
    g: number;
    h: number;
    f: number;
    parent: AStarNode | null;
}

export class NavigationGrid {
    // 阻挡网格：key = "x,z" → true = 阻挡
    private _blocked: Set<string> = new Set();
    private _worldMinX = 0;
    private _worldMaxX = 0;
    private _worldMinZ = 0;
    private _worldMaxZ = 0;

    /** 设置世界边界（tile 坐标） */
    setBounds(minX: number, maxX: number, minZ: number, maxZ: number) {
        this._worldMinX = minX;
        this._worldMaxX = maxX;
        this._worldMinZ = minZ;
        this._worldMaxZ = maxZ;
    }

    /** 设置/清除阻挡 */
    setBlocked(x: number, z: number, blocked: boolean) {
        const key = `${x},${z}`;
        if (blocked) this._blocked.add(key);
        else this._blocked.delete(key);
    }

    /** 批量设置阻挡（从 chunk 数据加载） */
    setBlockedBatch(cells: Array<{ x: number; z: number }>) {
        for (const c of cells) {
            this._blocked.add(`${c.x},${c.z}`);
        }
    }

    /** 清除某区域的阻挡（chunk 卸载时） */
    clearRegion(minX: number, maxX: number, minZ: number, maxZ: number) {
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                this._blocked.delete(`${x},${z}`);
            }
        }
    }

    isBlocked(x: number, z: number): boolean {
        return this._blocked.has(`${x},${z}`);
    }

    /** A* 寻路：世界坐标 → 路径点列表（世界坐标） */
    findPath(fromX: number, fromZ: number, toX: number, toZ: number): Vec3[] {
        const sx = Math.round(fromX);
        const sz = Math.round(fromZ);
        const ex = Math.round(toX);
        const ez = Math.round(toZ);

        if (this.isBlocked(ex, ez)) return [];

        const open: AStarNode[] = [];
        const closed = new Set<string>();
        const openMap = new Map<string, AStarNode>();

        const start: AStarNode = { x: sx, z: sz, g: 0, h: this._heuristic(sx, sz, ex, ez), f: 0, parent: null };
        start.f = start.h;
        open.push(start);
        openMap.set(`${sx},${sz}`, start);

        let iterations = 0;
        const maxIter = 2000; // 防止超长路径卡死

        while (open.length > 0 && iterations < maxIter) {
            iterations++;

            // 取 f 最小的
            open.sort((a, b) => a.f - b.f);
            const current = open.shift()!;
            const ck = `${current.x},${current.z}`;
            openMap.delete(ck);
            closed.add(ck);

            if (current.x === ex && current.z === ez) {
                return this._reconstruct(current);
            }

            for (const [dx, dz] of DIRS) {
                const nx = current.x + dx;
                const nz = current.z + dz;
                const nk = `${nx},${nz}`;

                if (closed.has(nk)) continue;
                if (this.isBlocked(nx, nz)) continue;
                if (nx < this._worldMinX || nx > this._worldMaxX) continue;
                if (nz < this._worldMinZ || nz > this._worldMaxZ) continue;

                // 对角线检查：两个相邻正方向不能都阻挡
                if (dx !== 0 && dz !== 0) {
                    if (this.isBlocked(current.x + dx, current.z) && this.isBlocked(current.x, current.z + dz)) continue;
                }

                const moveCost = (dx !== 0 && dz !== 0) ? 1.414 : 1.0;
                const g = current.g + moveCost;
                const existing = openMap.get(nk);

                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = g + existing.h;
                        existing.parent = current;
                    }
                } else {
                    const node: AStarNode = {
                        x: nx, z: nz,
                        g, h: this._heuristic(nx, nz, ex, ez),
                        f: 0, parent: current,
                    };
                    node.f = node.g + node.h;
                    open.push(node);
                    openMap.set(nk, node);
                }
            }
        }

        return []; // 无路
    }

    private _heuristic(x1: number, z1: number, x2: number, z2: number): number {
        // 对角线距离
        const dx = Math.abs(x1 - x2);
        const dz = Math.abs(z1 - z2);
        return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    }

    private _reconstruct(end: AStarNode): Vec3[] {
        const path: Vec3[] = [];
        let cur: AStarNode | null = end;
        while (cur) {
            path.push(new Vec3(cur.x, 0, cur.z));
            cur = cur.parent;
        }
        path.reverse();
        // 路径简化：去掉共线点
        return this._simplify(path);
    }

    private _simplify(path: Vec3[]): Vec3[] {
        if (path.length <= 2) return path;
        const result = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const next = path[i + 1];
            const dx1 = curr.x - prev.x;
            const dz1 = curr.z - prev.z;
            const dx2 = next.x - curr.x;
            const dz2 = next.z - curr.z;
            if (dx1 !== dx2 || dz1 !== dz2) {
                result.push(curr);
            }
        }
        result.push(path[path.length - 1]);
        return result;
    }
}

export const navGrid = new NavigationGrid();