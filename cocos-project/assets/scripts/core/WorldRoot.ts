import { _decorator, Component, Node, JsonAsset, resources } from 'cc';
import { bus, WorldEvents } from './EventBus';
import { featureRegistry } from './FeatureRegistry';
import { assetService } from './AssetService';
import { ChunkManager } from './ChunkManager';
import { CameraRig } from './CameraRig';
import { PerfGrader } from './PerfGrader';
import { PlatformAdapter } from './PlatformAdapter';

const { ccclass, property } = _decorator;

/**
 * 世界根节点 — 整个 3D 世界的入口与生命周期管理者。
 *
 * 职责：
 * 1. 初始化所有 core 子系统
 * 2. 加载世界配置（区域/chunk 映射）
 * 3. 驱动 ChunkManager tick
 * 4. 管理暂停/恢复
 * 5. 世界就绪后通知 FeatureRegistry
 *
 * WorldRoot 不 import 任何 Feature 模块。
 */
@ccclass('WorldRoot')
export class WorldRoot extends Component {

    @property(ChunkManager)
    chunkManager: ChunkManager | null = null;

    @property(CameraRig)
    cameraRig: CameraRig | null = null;

    @property(PerfGrader)
    perfGrader: PerfGrader | null = null;

    @property(Node)
    playerNode: Node | null = null;

    private _paused = false;
    private _ready = false;

    async onLoad() {
        console.log('[WorldRoot] init start');

        // 0. 平台检测
        const platform = PlatformAdapter.detect();
        console.log(`[WorldRoot] platform: ${platform}`);

        // 1. 资源服务初始化
        await assetService.init();

        // 2. 加载世界配置
        await this._loadWorldConfig();

        // 3. 绑定相机目标
        if (this.cameraRig && this.playerNode) {
            this.cameraRig.target = this.playerNode;
        }

        // 4. 标记就绪
        this._ready = true;
        bus.emit(WorldEvents.WORLD_READY, undefined as any);
        featureRegistry.notifyWorldReady();

        console.log('[WorldRoot] init complete');
    }

    update(dt: number) {
        if (this._paused || !this._ready) return;

        // 驱动 chunk 流式加载
        if (this.chunkManager && this.playerNode) {
            const wp = this.playerNode.worldPosition;
            this.chunkManager.tick(wp.x, wp.z, dt);
        }
    }

    /** 暂停世界（打开 UI 面板时调用） */
    pause() {
        this._paused = true;
        bus.emit(WorldEvents.WORLD_PAUSE, undefined as any);
    }

    /** 恢复世界 */
    resume() {
        this._paused = false;
        bus.emit(WorldEvents.WORLD_RESUME, undefined as any);
    }

    onDestroy() {
        featureRegistry.disposeAll();
        bus.clear();
    }

    get isReady(): boolean { return this._ready; }
    get isPaused(): boolean { return this._paused; }

    // ---- 内部 ----

    private async _loadWorldConfig() {
        return new Promise<void>((resolve) => {
            resources.load('configs/world_layout', JsonAsset, (err, json) => {
                if (err) {
                    console.warn('[WorldRoot] world_layout.json not found, using defaults');
                    resolve();
                    return;
                }
                const data = json.json as any;

                // 设置区域映射
                if (data.chunkZoneMap && this.chunkManager) {
                    this.chunkManager.setZoneMap(data.chunkZoneMap);
                }

                // 设置远程资源地址
                if (data.remoteAssetBase) {
                    assetService.setRemoteBase(data.remoteAssetBase);
                }

                console.log('[WorldRoot] world config loaded');
                resolve();
            });
        });
    }
}