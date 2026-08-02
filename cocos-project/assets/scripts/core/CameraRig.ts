import { _decorator, Component, Node, Vec3, Camera, view, math, input, Input, EventMouse, EventTouch } from 'cc';
import {
    CAM_ORTH_SIZE_DEFAULT, CAM_ORTH_SIZE_MIN, CAM_ORTH_SIZE_MAX,
    CAM_ELEVATION, CAM_AZIMUTH, CAM_FOLLOW_LERP,
    CHUNK_WORLD_SIZE, WORLD_CHUNKS_X, WORLD_CHUNKS_Z,
} from './Constants';

const { ccclass, property } = _decorator;

/**
 * 2.5D 等距正交相机 — 固定角度、平滑跟随、捏合缩放、世界边界钳制。
 */
@ccclass('CameraRig')
export class CameraRig extends Component {

    @property(Camera)
    camera: Camera | null = null;

    @property(Node)
    target: Node | null = null;   // 跟随目标（玩家节点）

    private _orthoSize = CAM_ORTH_SIZE_DEFAULT;
    private _targetOrthoSize = CAM_ORTH_SIZE_DEFAULT;
    private _currentPos = new Vec3();
    private _targetPos = new Vec3();

    // 等距角度预计算
    private _elevationRad = CAM_ELEVATION * Math.PI / 180;
    private _azimuthRad = CAM_AZIMUTH * Math.PI / 180;

    // 捏合缩放
    private _pinchStartDist = 0;
    private _pinchStartSize = 0;

    // 世界边界
    private _worldMinX = 0;
    private _worldMaxX = WORLD_CHUNKS_X * CHUNK_WORLD_SIZE;
    private _worldMinZ = 0;
    private _worldMaxZ = WORLD_CHUNKS_Z * CHUNK_WORLD_SIZE;

    onLoad() {
        this._applyRotation();
        if (this.target) {
            const wp = this.target.worldPosition;
            this._currentPos.set(wp);
            this.node.setWorldPosition(this._computeCamPos(wp));
        }
        this._setupPinch();
    }

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.on(Input.EventType.MOUSE_WHEEL, this._onWheel, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.off(Input.EventType.MOUSE_WHEEL, this._onWheel, this);
    }

    update(dt: number) {
        if (!this.target) return;

        const wp = this.target.worldPosition;
        this._targetPos.set(wp);

        // 平滑跟随
        Vec3.lerp(this._currentPos, this._currentPos, this._targetPos, CAM_FOLLOW_LERP);

        // 世界边界钳制
        this._clampToBounds(this._currentPos);

        // 设置相机位置
        this.node.setWorldPosition(this._computeCamPos(this._currentPos));

        // 平滑缩放
        if (Math.abs(this._orthoSize - this._targetOrthoSize) > 0.01) {
            this._orthoSize += (this._targetOrthoSize - this._orthoSize) * 0.15;
            if (this.camera) {
                this.camera.orthoHeight = this._orthoSize;
            }
        }
    }

    /** 世界坐标 → 等距网格坐标 */
    static worldToGrid(wx: number, wz: number): { gx: number; gz: number } {
        return { gx: Math.floor(wx), gz: Math.floor(wz) };
    }

    /** 世界坐标 → chunk 坐标 */
    static worldToChunk(wx: number, wz: number): { cx: number; cz: number } {
        return {
            cx: Math.floor(wx / CHUNK_WORLD_SIZE),
            cz: Math.floor(wz / CHUNK_WORLD_SIZE),
        };
    }

    /** chunk 坐标 → 世界中心坐标 */
    static chunkToWorldCenter(cx: number, cz: number): Vec3 {
        return new Vec3(
            cx * CHUNK_WORLD_SIZE + CHUNK_WORLD_SIZE / 2,
            0,
            cz * CHUNK_WORLD_SIZE + CHUNK_WORLD_SIZE / 2,
        );
    }

    get orthoSize(): number { return this._orthoSize; }

    // ---- 内部 ----

    private _applyRotation() {
        const e = this._elevationRad;
        const a = this._azimuthRad;
        // 等距相机朝向：从目标点往斜上方看
        const dir = new Vec3(
            -Math.sin(a) * Math.cos(e),
            Math.sin(e),
            -Math.cos(a) * Math.cos(e),
        );
        const up = new Vec3(0, 1, 0);
        const quat = math.Quat.fromViewUp(new math.Quat(), dir, up);
        this.node.setRotation(quat);
    }

    private _computeCamPos(target: Vec3): Vec3 {
        // 相机在目标的斜上方
        const dist = this._orthoSize * 3;
        const e = this._elevationRad;
        const a = this._azimuthRad;
        return new Vec3(
            target.x - Math.sin(a) * Math.cos(e) * dist,
            target.y + Math.sin(e) * dist,
            target.z - Math.cos(a) * Math.cos(e) * dist,
        );
    }

    private _clampToBounds(pos: Vec3) {
        const margin = this._orthoSize * 0.5;
        pos.x = Math.max(this._worldMinX + margin, Math.min(this._worldMaxX - margin, pos.x));
        pos.z = Math.max(this._worldMinZ + margin, Math.min(this._worldMaxZ - margin, pos.z));
    }

    private _setupPinch() { /* touch events handle pinch */ }

    private _touches: Map<number, Vec3> = new Map();

    private _onTouchStart(e: EventTouch) {
        const t = e.getTouch();
        this._touches.set(t.getID(), new Vec3(t.getUILocationX(), t.getUILocationY(), 0));
        if (this._touches.size === 2) {
            const pts = Array.from(this._touches.values());
            this._pinchStartDist = Vec3.distance(pts[0], pts[1]);
            this._pinchStartSize = this._targetOrthoSize;
        }
    }

    private _onTouchMove(e: EventTouch) {
        const t = e.getTouch();
        this._touches.set(t.getID(), new Vec3(t.getUILocationX(), t.getUILocationY(), 0));
        if (this._touches.size === 2) {
            const pts = Array.from(this._touches.values());
            const dist = Vec3.distance(pts[0], pts[1]);
            if (this._pinchStartDist > 0) {
                const ratio = this._pinchStartDist / dist;
                this._targetOrthoSize = Math.max(
                    CAM_ORTH_SIZE_MIN,
                    Math.min(CAM_ORTH_SIZE_MAX, this._pinchStartSize * ratio),
                );
            }
        }
    }

    private _onTouchEnd(e: EventTouch) {
        this._touches.delete(e.getTouch().getID());
        if (this._touches.size < 2) this._pinchStartDist = 0;
    }

    private _onWheel(e: EventMouse) {
        const delta = e.getScrollY() * 0.01;
        this._targetOrthoSize = Math.max(
            CAM_ORTH_SIZE_MIN,
            Math.min(CAM_ORTH_SIZE_MAX, this._targetOrthoSize + delta),
        );
    }
}