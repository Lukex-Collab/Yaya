import { _decorator, Component, Node, Vec3, Prefab, instantiate } from 'cc';
import { bus, WorldEvents } from './EventBus';
import { assetService } from './AssetService';
import { CameraRig } from './CameraRig';
import {
    CHUNK_WORLD_SIZE, LOAD_RADIUS_P1, LOAD_RADIUS_P2, MAX_LOADED_CHUNKS,
} from './Constants';

const { ccclass, property } = _decorator;

// ---- Chunk 状态 ----
enum ChunkState {
    UNLOADED,
    LOADING,
    LOADED,
    UNLOADING,
}

interface ChunkEntry {
    cx: number;
    cz: number;
    state: ChunkState;
    node: Node | null;       // 场景中的根节点
    priority: number;
    lastAccess: number;
}

/**
 * Chunk 管理器 — 根据玩家位置流式加载/卸载 chunk。
 *
 * 加载策略：
 *   P0 = 当前 chunk（立即）
 *   P1 = 相邻 8 chunks（队列）
 *   P2 = 再外圈 16 chunks（空闲时）
 *   超出 LRU 上限 → 卸载最久未访问的
 */
@ccclass('ChunkManager')
export class ChunkManager extends Component {

    @property(Node)
    chunkRoot: Node | null = null;   // 所有 chunk 节点的父节点

    private _chunks: Map<string, ChunkEntry> = new Map();
    private _loadQueue: ChunkEntry[] = [];
    private _currentCX = -999;
    private _currentCZ = -999;
    private _processTimer = 0;

    // 区域映射：chunk 坐标 → zoneId（从配置加载）
    private _zoneMap: Map<string, string> = new Map();

    onLoad() {
        if (!this.chunkRoot) {
            this.chunkRoot = new Node('ChunkRoot');
            this.node.addChild(this.chunkRoot);
        }
    }

    /** 设置区域映射（从 world_layout.json 加载后调用） */
    setZoneMap(map: Record<string, string>) {
        this._zoneMap.clear();
        for (const [key, zone] of Object.entries(map)) {
            this._zoneMap.set(key, zone);
        }
    }

    /** 每帧由 WorldRoot 调用，传入玩家世界坐标 */
    tick(playerX: number, playerZ: number, dt: number) {
        const { cx, cz } = CameraRig.worldToChunk(playerX, playerZ);

        if (cx !== this._currentCX || cz !== this._currentCZ) {
            const from = { cx: this._currentCX, cz: this._currentCZ };
            this._currentCX = cx;
            this._currentCZ = cz;
            this._onChunkChange(cx, cz, from);
            bus.emit(WorldEvents.CHUNK_CHANGE, { from, to: { cx, cz } });
        }

        // 处理加载队列（每帧最多处理 2 个，避免卡顿）
        this._processTimer += dt;
        if (this._processTimer >= 0.05) {  // 每 50ms 处理一批
            this._processTimer = 0;
            this._processQueue(2);
        }
    }

    /** 获取 chunk 所在区域 */
    getZoneAt(cx: number, cz: number): string {
        return this._zoneMap.get(`${cx},${cz}`) || 'unknown';
    }

    /** 获取已加载的 chunk 节点 */
    getChunkNode(cx: number, cz: number): Node | null {
        return this._chunks.get(`${cx},${cz}`)?.node ?? null;
    }

    get loadedCount(): number {
        let n = 0;
        for (const e of this._chunks.values()) {
            if (e.state === ChunkState.LOADED) n++;
        }
        return n;
    }

    // ---- 内部 ----

    private _onChunkChange(cx: number, cz: number, from: { cx: number; cz: number }) {
        // 1. 计算需要加载的 chunk 列表
        const needed = new Set<string>();
        const priorities: Map<string, number> = new Map();

        for (let dx = -LOAD_RADIUS_P2; dx <= LOAD_RADIUS_P2; dx++) {
            for (let dz = -LOAD_RADIUS_P2; dz <= LOAD_RADIUS_P2; dz++) {
                const ncx = cx + dx;
                const ncz = cz + dz;
                const key = `${ncx},${ncz}`;
                needed.add(key);

                const dist = Math.max(Math.abs(dx), Math.abs(dz));
                let pri = 2;
                if (dist === 0) pri = 0;
                else if (dist <= LOAD_RADIUS_P1) pri = 1;
                priorities.set(key, pri);
            }
        }

        // 2. 标记不再需要的 chunk 为可卸载
        for (const [key, entry] of this._chunks) {
            if (!needed.has(key) && entry.state === ChunkState.LOADED) {
                this._unloadChunk(entry);
            }
        }

        // 3. 将需要但未加载的 chunk 加入队列
        for (const key of needed) {
            let entry = this._chunks.get(key);
            if (!entry) {
                const [cxStr, czStr] = key.split(',');
                entry = {
                    cx: parseInt(cxStr),
                    cz: parseInt(czStr),
                    state: ChunkState.UNLOADED,
                    node: null,
                    priority: priorities.get(key)!,
                    lastAccess: Date.now(),
                };
                this._chunks.set(key, entry);
            }
            if (entry.state === ChunkState.UNLOADED) {
                entry.priority = priorities.get(key)!;
                entry.state = ChunkState.LOADING;
                this._loadQueue.push(entry);
            } else if (entry.state === ChunkState.LOADED) {
                entry.lastAccess = Date.now();
            }
        }

        // 4. 按优先级排序队列
        this._loadQueue.sort((a, b) => a.priority - b.priority);

        // 5. LRU 淘汰
        this._enforceLRU();
    }

    private _processQueue(maxPerTick: number) {
        let processed = 0;
        while (this._loadQueue.length > 0 && processed < maxPerTick) {
            const entry = this._loadQueue.shift()!;
            if (entry.state !== ChunkState.LOADING) continue;
            this._doLoad(entry);
            processed++;
        }
    }

    private async _doLoad(entry: ChunkEntry) {
        const bundleName = `chunk_${entry.cx}_${entry.cz}`;
        try {
            // 尝试加载远程 bundle
            const bundle = await assetService.loadBundle(bundleName);

            // 加载 chunk 预制体
            const prefab = await new Promise<Prefab>((resolve, reject) => {
                bundle.load('chunk', Prefab, (err, p) => {
                    if (err) reject(err);
                    else resolve(p);
                });
            });

            const node = instantiate(prefab);
            node.setPosition(
                entry.cx * CHUNK_WORLD_SIZE,
                0,
                entry.cz * CHUNK_WORLD_SIZE,
            );
            this.chunkRoot!.addChild(node);
            entry.node = node;
            entry.state = ChunkState.LOADED;
            entry.lastAccess = Date.now();

            bus.emit(WorldEvents.CHUNK_LOADED, { cx: entry.cx, cz: entry.cz });
        } catch (e) {
            // chunk 不存在（空白区域/水域），标记为已加载空节点
            entry.state = ChunkState.LOADED;
            entry.node = null;
        }
    }

    private _unloadChunk(entry: ChunkEntry) {
        entry.state = ChunkState.UNLOADING;
        if (entry.node) {
            entry.node.removeFromParent();
            entry.node.destroy();
            entry.node = null;
        }
        const bundleName = `chunk_${entry.cx}_${entry.cz}`;
        assetService.releaseBundle(bundleName);
        entry.state = ChunkState.UNLOADED;

        bus.emit(WorldEvents.CHUNK_UNLOADED, { cx: entry.cx, cz: entry.cz });
    }

    private _enforceLRU() {
        const loaded = Array.from(this._chunks.values())
            .filter(e => e.state === ChunkState.LOADED)
            .sort((a, b) => a.lastAccess - b.lastAccess);

        while (loaded.length > MAX_LOADED_CHUNKS) {
            const oldest = loaded.shift()!;
            // 不卸载 P0（当前 chunk）
            if (oldest.cx === this._currentCX && oldest.cz === this._currentCZ) continue;
            this._unloadChunk(oldest);
        }
    }
}