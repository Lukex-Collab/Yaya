import { _decorator, Component, Color, Tween, tween, director } from 'cc';
import { bus, WorldEvents } from '../core/EventBus';
import { ZoneManager, ZoneDef } from './ZoneManager';
import { ZONE_TRANSITION_DURATION } from '../core/Constants';

const { ccclass, property } = _decorator;

/**
 * 区域过渡效果 — 色调 Lerp + 雾变化 + 环境音交叉淡变。
 * 监听 ZONE_TRANSITION 事件，驱动视觉/音频过渡。
 */
@ccclass('ZoneTransition')
export class ZoneTransition extends Component {

    @property(ZoneManager)
    zoneManager: ZoneManager | null = null;

    // 当前色调/雾参数（Lerp 用）
    private _currentColor = new Color(255, 255, 255, 255);
    private _targetColor = new Color(255, 255, 255, 255);
    private _currentFogDensity = 0;
    private _targetFogDensity = 0;
    private _transitioning = false;
    private _transitionProgress = 0;

    // 环境音（简化：记录当前/目标音频名，实际播放由 AudioService 处理）
    private _currentAudio = '';
    private _targetAudio = '';

    onEnable() {
        bus.on(WorldEvents.ZONE_ENTER, this._onZoneEnter, this);
    }

    onDisable() {
        bus.off(WorldEvents.ZONE_ENTER, this._onZoneEnter, this);
    }

    update(dt: number) {
        if (!this._transitioning) return;

        this._transitionProgress += dt / ZONE_TRANSITION_DURATION;
        if (this._transitionProgress >= 1) {
            this._transitionProgress = 1;
            this._transitioning = false;
        }

        const t = this._smoothstep(this._transitionProgress);

        // Lerp 色调
        this._currentColor.r = Math.round(this._lerp(this._currentColor.r, this._targetColor.r, t));
        this._currentColor.g = Math.round(this._lerp(this._currentColor.g, this._targetColor.g, t));
        this._currentColor.b = Math.round(this._lerp(this._currentColor.b, this._targetColor.b, t));

        // Lerp 雾
        this._currentFogDensity = this._lerp(this._currentFogDensity, this._targetFogDensity, t);

        // 发送进度事件（供后处理/天空盒使用）
        const zone = this.zoneManager?.currentZone;
        if (zone) {
            bus.emit(WorldEvents.ZONE_TRANSITION, {
                fromZone: '',
                toZone: zone.id,
                progress: this._transitionProgress,
            });
        }
    }

    /** 获取当前色调覆盖（供后处理组件读取） */
    get tintColor(): Color { return this._currentColor; }
    get fogDensity(): number { return this._currentFogDensity; }

    private _onZoneEnter(payload: { zoneId: string }) {
        const zone = this.zoneManager?.getZone(payload.zoneId);
        if (!zone) return;

        // 设置目标
        this._targetColor.set(
            Math.round(zone.ambientColor[0] * 255),
            Math.round(zone.ambientColor[1] * 255),
            Math.round(zone.ambientColor[2] * 255),
            255,
        );
        this._targetFogDensity = zone.fogDensity;
        this._targetAudio = zone.ambientAudio;

        // 开始过渡
        this._transitioning = true;
        this._transitionProgress = 0;
    }

    private _lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private _smoothstep(t: number): number {
        return t * t * (3 - 2 * t);
    }
}