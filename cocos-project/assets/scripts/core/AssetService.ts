import { assetManager, Asset, AssetBundle, resources } from 'cc';
import { PlatformAdapter } from './PlatformAdapter';
import { REMOTE_ASSET_BASE } from './Constants';

/**
 * 资源服务 — 远程 Bundle 加载 + 本地缓存 + LRU 淘汰。
 *
 * 设计：
 * - 首包只含启动核心，所有场景/物种/音频 bundle 走远程 CDN
 * - 已下载 bundle 缓存到小游戏 fs 用户目录
 * - LRU 控制内存中 bundle 引用数
 */

interface CacheEntry {
    bundle: AssetBundle;
    lastAccess: number;
    name: string;
}

export class AssetService {
    private _cache: Map<string, CacheEntry> = new Map();
    private _loading: Map<string, Promise<AssetBundle>> = new Map();
    private _maxCache = 20;
    private _remoteBase: string = REMOTE_ASSET_BASE;
    private _manifest: Record<string, string> = {};  // bundleName -> hash

    /** 初始化：加载远程 manifest */
    async init(manifestUrl?: string) {
        if (manifestUrl) {
            try {
                const resp = await fetch(manifestUrl);
                this._manifest = await resp.json();
            } catch (e) {
                console.warn('[AssetService] manifest load failed, using empty', e);
            }
        }
    }

    setRemoteBase(url: string) { this._remoteBase = url; }

    /** 加载 bundle（优先缓存 → 去重加载 → 远程下载） */
    async loadBundle(name: string): Promise<AssetBundle> {
        // 1. 缓存命中
        const cached = this._cache.get(name);
        if (cached) {
            cached.lastAccess = Date.now();
            return cached.bundle;
        }

        // 2. 正在加载，等待
        const pending = this._loading.get(name);
        if (pending) return pending;

        // 3. 开始加载
        const promise = this._doLoad(name);
        this._loading.set(name, promise);
        try {
            const bundle = await promise;
            this._cacheSet(name, bundle);
            return bundle;
        } finally {
            this._loading.delete(name);
        }
    }

    /** 从 bundle 加载资源 */
    async loadAsset<T extends Asset>(bundleName: string, path: string, type: new (...args: any[]) => T): Promise<T> {
        const bundle = await this.loadBundle(bundleName);
        return new Promise((resolve, reject) => {
            bundle.load(path, type, (err, asset) => {
                if (err) reject(err);
                else resolve(asset);
            });
        });
    }

    /** 释放 bundle */
    releaseBundle(name: string) {
        const entry = this._cache.get(name);
        if (entry) {
            entry.bundle.releaseAll();
            assetManager.removeBundle(entry.bundle);
            this._cache.delete(name);
        }
    }

    /** 预加载 bundle 列表 */
    async preload(names: string[]): Promise<void> {
        await Promise.allSettled(names.map(n => this.loadBundle(n)));
    }

    get cacheSize(): number { return this._cache.size; }

    // ---- 内部 ----

    private _doLoad(name: string): Promise<AssetBundle> {
        return new Promise((resolve, reject) => {
            const hash = this._manifest[name] || '';
            const url = hash
                ? `${this._remoteBase}/${name}/${hash}`
                : `${this._remoteBase}/${name}`;

            assetManager.loadBundle(url, { version: hash }, (err, bundle) => {
                if (err) {
                    // 回退：尝试从 resources 加载（开发模式）
                    assetManager.loadBundle(name, (err2, bundle2) => {
                        if (err2) reject(err2);
                        else resolve(bundle2);
                    });
                } else {
                    resolve(bundle);
                }
            });
        });
    }

    private _cacheSet(name: string, bundle: AssetBundle) {
        // LRU 淘汰
        if (this._cache.size >= this._maxCache) {
            this._evictLRU();
        }
        this._cache.set(name, { bundle, lastAccess: Date.now(), name });
    }

    private _evictLRU() {
        let oldest: CacheEntry | null = null;
        for (const entry of this._cache.values()) {
            if (!oldest || entry.lastAccess < oldest.lastAccess) {
                oldest = entry;
            }
        }
        if (oldest) {
            console.log(`[AssetService] LRU evict: ${oldest.name}`);
            this.releaseBundle(oldest.name);
        }
    }
}

export const assetService = new AssetService();