import { _decorator, Component, JsonAsset, resources } from 'cc';
import { WorldRoot } from './core/WorldRoot';
import { featureRegistry } from './core/FeatureRegistry';

const { ccclass, property } = _decorator;

/**
 * 应用入口 — 挂载到场景根节点。
 * 负责：加载 Feature Flag → 注册模块 → 启动世界。
 */
@ccclass('AppEntry')
export class AppEntry extends Component {

    @property(WorldRoot)
    worldRoot: WorldRoot | null = null;

    async onLoad() {
        console.log('[AppEntry] start');

        // 1. 加载 Feature Flag
        const flags = await this._loadFlags();
        featureRegistry.applyFlags(flags);

        // 2. WorldRoot.onLoad 会自动执行
        // Feature 模块注册在各 Feature 文件的 import 副作用中完成
        // （或者在此处手动 register，取决于团队偏好）

        console.log('[AppEntry] ready');
    }

    private _loadFlags(): Promise<Record<string, boolean>> {
        return new Promise((resolve) => {
            resources.load('configs/feature_flags', JsonAsset, (err, json) => {
                if (err) {
                    console.warn('[AppEntry] feature_flags not found, all disabled');
                    resolve({});
                    return;
                }
                const data = json.json as Record<string, any>;
                const flags: Record<string, boolean> = {};
                for (const [k, v] of Object.entries(data)) {
                    if (k.startsWith('_')) continue;
                    flags[k] = !!v;
                }
                resolve(flags);
            });
        });
    }
}