import { bus, WorldEvents } from '../../core/EventBus';
import { IFeatureModule } from '../../core/FeatureRegistry';

/**
 * 功能模块模板 — 新建 Feature 时复制此文件。
 *
 * 规则：
 * 1. 只依赖 core/ 接口和 EventBus，不 import 其他 Feature
 * 2. init() 中订阅事件、加载资源
 * 3. dispose() 中取消订阅、释放资源
 * 4. Flag 关时 init 不会被调用 = 零成本
 */
export class FeatureTemplate implements IFeatureModule {
    readonly id = 'template';

    init() {
        console.log(`[Feature:${this.id}] init`);
        // 订阅事件
        bus.on(WorldEvents.PLAYER_INTERACT, this._onInteract, this);
    }

    onWorldReady() {
        console.log(`[Feature:${this.id}] world ready`);
        // 世界就绪后的初始化（如加载预制内容）
    }

    dispose() {
        console.log(`[Feature:${this.id}] dispose`);
        // 取消所有订阅
        bus.off(WorldEvents.PLAYER_INTERACT, this._onInteract, this);
    }

    private _onInteract(payload: { targetId: string }) {
        // 处理交互
    }
}