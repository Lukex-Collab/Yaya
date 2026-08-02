import { bus, WorldEvents } from './EventBus';

/**
 * 功能模块接口 — 所有 Feature 必须实现。
 * WorldCore 只认这个接口，不知道具体 Feature 的存在。
 */
export interface IFeatureModule {
    readonly id: string;
    init(): void;
    onWorldReady(): void;
    dispose(): void;
}

/**
 * 功能注册表 — 管理模块注册、远程 Flag 开关、生命周期。
 *
 * 关键设计：
 * - 代码全量编进包（微信小游戏禁止热更代码）
 * - 远程 Flag 控制启用/灰度/回滚
 * - Flag 关 = init 直接 return、不订阅事件、不下资源 = 真正零成本
 */
export class FeatureRegistry {
    private _modules: Map<string, IFeatureModule> = new Map();
    private _flags: Map<string, boolean> = new Map();
    private _initialized: Set<string> = new Set();

    /** 注册模块（代码层面，init 前） */
    register(mod: IFeatureModule): void {
        if (this._modules.has(mod.id)) {
            console.warn(`[FeatureRegistry] duplicate module: ${mod.id}`);
            return;
        }
        this._modules.set(mod.id, mod);
    }

    /** 应用远程 Flag 配置 */
    applyFlags(flags: Record<string, boolean>): void {
        for (const [id, enabled] of Object.entries(flags)) {
            this._flags.set(id, enabled);
        }
        // 对已注册模块执行启停
        for (const [id, mod] of this._modules) {
            const shouldEnable = this._flags.get(id) ?? false;
            const isEnabled = this._initialized.has(id);
            if (shouldEnable && !isEnabled) {
                this._enable(mod);
            } else if (!shouldEnable && isEnabled) {
                this._disable(mod);
            }
        }
    }

    /** 世界就绪时，对所有 Flag=true 的模块调 onWorldReady */
    notifyWorldReady(): void {
        for (const [id, mod] of this._modules) {
            if (this._initialized.has(id)) {
                try { mod.onWorldReady(); } catch (e) { console.error(`[FeatureRegistry] onWorldReady error: ${id}`, e); }
            }
        }
    }

    /** 全部销毁 */
    disposeAll(): void {
        for (const [id, mod] of this._modules) {
            if (this._initialized.has(id)) {
                this._disable(mod);
            }
        }
        this._modules.clear();
        this._flags.clear();
    }

    isEnabled(id: string): boolean { return this._initialized.has(id); }
    getModule(id: string): IFeatureModule | undefined { return this._modules.get(id); }

    private _enable(mod: IFeatureModule): void {
        try {
            mod.init();
            this._initialized.add(mod.id);
            bus.emit(WorldEvents.FEATURE_ENABLED, { featureId: mod.id });
            console.log(`[FeatureRegistry] enabled: ${mod.id}`);
        } catch (e) {
            console.error(`[FeatureRegistry] init error: ${mod.id}`, e);
        }
    }

    private _disable(mod: IFeatureModule): void {
        try {
            mod.dispose();
            this._initialized.delete(mod.id);
            bus.emit(WorldEvents.FEATURE_DISABLED, { featureId: mod.id });
            console.log(`[FeatureRegistry] disabled: ${mod.id}`);
        } catch (e) {
            console.error(`[FeatureRegistry] dispose error: ${mod.id}`, e);
        }
    }
}

export const featureRegistry = new FeatureRegistry();