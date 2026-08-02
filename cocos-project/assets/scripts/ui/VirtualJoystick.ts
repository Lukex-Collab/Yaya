import { _decorator, Component, Node, EventTouch, Vec2, Vec3, UITransform, input, Input } from 'cc';
import { PlayerController } from '../player/PlayerController';

const { ccclass, property } = _decorator;

/**
 * 虚拟摇杆 — 左下角触摸控制。
 * 输出归一化方向给 PlayerController。
 * 双击切换跑/走。
 */
@ccclass('VirtualJoystick')
export class VirtualJoystick extends Component {

    @property(Node)
    stick: Node | null = null;      // 摇杆手柄

    @property(Node)
    bg: Node | null = null;         // 摇杆底盘

    @property(PlayerController)
    player: PlayerController | null = null;

    @property
    maxRadius: number = 60;         // 摇杆最大半径（像素）

    @property
    deadZone: number = 0.15;        // 死区

    private _touchId: number = -1;
    private _center = new Vec2();
    private _active = false;
    private _lastTapTime = 0;

    onEnable() {
        this.node.on(Node.EventType.TOUCH_START, this._onStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onEnd, this);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this._onStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onEnd, this);
    }

    private _onStart(e: EventTouch) {
        if (this._active) return;
        this._active = true;
        this._touchId = e.getTouch().getID();

        const uiPos = e.getUILocation();
        this._center.set(uiPos.x, uiPos.y);

        // 双击检测
        const now = Date.now();
        if (now - this._lastTapTime < 300) {
            this.player?.setRunning(true);
        }
        this._lastTapTime = now;

        // 显示摇杆
        if (this.bg) this.bg.active = true;
        if (this.stick) {
            this.stick.active = true;
            this.stick.setPosition(0, 0, 0);
        }
    }

    private _onMove(e: EventTouch) {
        if (!this._active || e.getTouch().getID() !== this._touchId) return;

        const uiPos = e.getUILocation();
        let dx = uiPos.x - this._center.x;
        let dy = uiPos.y - this._center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.maxRadius) {
            dx = dx / dist * this.maxRadius;
            dy = dy / dist * this.maxRadius;
        }

        // 移动手柄
        if (this.stick) {
            this.stick.setPosition(dx, dy, 0);
        }

        // 归一化输出
        const nx = dx / this.maxRadius;
        const ny = dy / this.maxRadius;
        const mag = Math.sqrt(nx * nx + ny * ny);

        if (mag < this.deadZone) {
            this.player?.setJoystickInput(0, 0);
        } else {
            // 屏幕坐标 → 世界方向（等距相机 45° 旋转）
            // 屏幕右 = 世界 (+X, +Z) 对角线方向
            // 屏幕上 = 世界 (-X, +Z) 对角线方向
            const worldX = (nx + ny) * 0.707;
            const worldZ = (-nx + ny) * 0.707;
            this.player?.setJoystickInput(worldX, worldZ);
        }
    }

    private _onEnd(e: EventTouch) {
        if (e.getTouch().getID() !== this._touchId) return;
        this._active = false;
        this._touchId = -1;

        if (this.stick) this.stick.setPosition(0, 0, 0);
        this.player?.clearJoystickInput();
        this.player?.setRunning(false);
    }
}