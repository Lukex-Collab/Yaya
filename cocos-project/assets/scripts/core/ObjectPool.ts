import { Node, Prefab, instantiate, NodePool } from 'cc';

/**
 * 通用对象池 — 避免频繁 instantiate/destroy 造成 GC 卡顿。
 */
export class ObjectPool {
    private _pools: Map<string, NodePool> = new Map();

    /** 预热 */
    warmUp(key: string, prefab: Prefab, count: number) {
        let pool = this._pools.get(key);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(key, pool);
        }
        for (let i = 0; i < count; i++) {
            pool.put(instantiate(prefab));
        }
    }

    /** 取出 */
    get(key: string, prefab?: Prefab): Node | null {
        const pool = this._pools.get(key);
        if (pool && pool.size() > 0) {
            return pool.get()!;
        }
        if (prefab) {
            return instantiate(prefab);
        }
        return null;
    }

    /** 归还 */
    put(key: string, node: Node) {
        let pool = this._pools.get(key);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(key, pool);
        }
        node.removeFromParent();
        pool.put(node);
    }

    /** 清空 */
    clear(key?: string) {
        if (key) {
            this._pools.get(key)?.clear();
            this._pools.delete(key);
        } else {
            for (const pool of this._pools.values()) pool.clear();
            this._pools.clear();
        }
    }

    size(key: string): number {
        return this._pools.get(key)?.size() ?? 0;
    }
}

export const objectPool = new ObjectPool();