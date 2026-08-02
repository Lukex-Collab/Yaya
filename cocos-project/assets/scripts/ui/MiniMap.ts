import { _decorator, Component, Node, Graphics, Color, Vec3 } from 'cc';
import { bus, WorldEvents } from '../core/EventBus';
import { CameraRig } from '../core/CameraRig';
import { CHUNK_WORLD_SIZE, WORLD_CHUNKS_X, WORLD_CHUNKS_Z } from '../core/Constants';

const { ccclass, property } = _decorator;

/**
 * 小地图 — 右上角圆形，显示已探索区域 + 玩家/宠物位置。
 */
@ccclass('MiniMap')
export class MiniMap extends Component {

    @property(Graphics)
    gfx: Graphics | null = null;

    @property(Node)
    playerDot: Node | null = null;

    @property(Node)
    petDot: Node | null = null;

    @property
    mapRadius: number = 80;        // 小地图半径（像素）

    @property
    mapScale: number = 0.003;      // 世界坐标 → 像素

    private _explored: Set<string> = new Set();  // "cx,cz"
    private _zoneColors: Record<string, Color> = {
        'HUB':  new Color(200, 180, 140, 180),
        'Z-N':  new Color(60, 120, 60, 180),
        'Z-E':  new Color(200, 160, 80, 180),
        'Z-SE': new Color(60, 100, 140, 180),
        'Z-S':  new Color(140, 120, 160, 180),
        'Z-W':  new Color(140, 100, 80, 180),
        'Z-NW': new Color(100, 180, 200, 180),
    };
    private _defaultColor = new Color(80, 80, 80, 100);
    private _fogColor = new Color(40, 40, 40, 120);
    private _dirty = true;

    onEnable() {
        bus.on(WorldEvents.CHUNK_LOADED, this._onChunkLoaded, this);
        bus.on(WorldEvents.PLAYER_MOVE, this._onPlayerMove, this);
    }

    onDisable() {
        bus.off(WorldEvents.CHUNK_LOADED, this._onChunkLoaded, this);
        bus.off(WorldEvents.PLAYER_MOVE, this._onPlayerMove, this);
    }

    update(_dt: number) {
        if (this._dirty) {
            this._redraw();
            this._dirty = false;
        }
    }

    private _onChunkLoaded(payload: { cx: number; cz: number }) {
        this._explored.add(`${payload.cx},${payload.cz}`);
        this._dirty = true;
    }

    private _onPlayerMove(_payload: { x: number; z: number }) {
        this._updateDots();
    }

    private _redraw() {
        if (!this.gfx) return;
        this.gfx.clear();

        // 圆形裁剪背景
        this.gfx.fillColor = this._fogColor;
        this.gfx.circle(0, 0, this.mapRadius);
        this.gfx.fill();

        // 已探索 chunk
        for (const key of this._explored) {
            const [cxStr, czStr] = key.split(',');
            const cx = parseInt(cxStr);
            const cz = parseInt(czStr);
            const px = (cx - WORLD_CHUNKS_X / 2) * CHUNK_WORLD_SIZE * this.mapScale;
            const py = (cz - WORLD_CHUNKS_Z / 2) * CHUNK_WORLD_SIZE * this.mapScale;
            const size = CHUNK_WORLD_SIZE * this.mapScale;

            // 根据区域着色（简化：用默认色）
            this.gfx.fillColor = this._defaultColor;
            this.gfx.rect(px, py, size, size);
            this.gfx.fill();
        }

        // 圆形边框
        this.gfx.strokeColor = new Color(255, 255, 255, 100);
        this.gfx.lineWidth = 2;
        this.gfx.circle(0, 0, this.mapRadius);
        this.gfx.stroke();
    }

    private _updateDots() {
        // 玩家/宠物点的位置更新由外部设置 worldPosition 后换算
        // 简化：在 update 中处理
    }
}