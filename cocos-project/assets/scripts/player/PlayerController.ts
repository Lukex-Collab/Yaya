import { _decorator, Component, Node, Vec3, Animation, SkeletalAnimation, input, Input } from 'cc';
import { bus, WorldEvents } from '../core/EventBus';
import { navGrid } from '../core/NavigationGrid';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '../core/Constants';

const { ccclass, property } = _decorator;

const _tmpV3 = new Vec3();

/**
 * 玩家控制器 — 摇杆移动 + 点击寻路 + 动画状态。
 */
@ccclass('PlayerController')
export class PlayerController extends Component {

    @property(SkeletalAnimation)
    anim: SkeletalAnimation | null = null;

    private _speed = PLAYER_WALK_SPEED;
    private _running = false;
    private _moveDir = new Vec3();     // 摇杆输入方向（归一化）
    private _hasJoystickInput = false;

    // 点击寻路
    private _path: Vec3[] = [];
    private _pathIndex = 0;
    private _followingPath = false;

    // 动画
    private _animState: 'idle' | 'walk' | 'run' = 'idle';

    onLoad() {
        input.on(Input.EventType.TOUCH_END, this._onTap, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_END, this._onTap, this);
    }

    /** 摇杆输入（由 VirtualJoystick 调用） */
    setJoystickInput(dx: number, dz: number) {
        this._moveDir.set(dx, 0, dz);
        this._hasJoystickInput = (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1);
        if (this._hasJoystickInput) {
            this._followingPath = false; // 摇杆优先
        }
    }

    clearJoystickInput() {
        this._hasJoystickInput = false;
        this._moveDir.set(0, 0, 0);
    }

    /** 切换跑/走 */
    setRunning(run: boolean) {
        this._running = run;
        this._speed = run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    }

    update(dt: number) {
        let moved = false;

        if (this._hasJoystickInput) {
            // 摇杆直接移动
            _tmpV3.set(this._moveDir.x * this._speed * dt, 0, this._moveDir.z * this._speed * dt);
            this._tryMove(_tmpV3);
            moved = true;
            this._faceDirection(this._moveDir.x, this._moveDir.z);
        } else if (this._followingPath) {
            // 沿路径移动
            moved = this._followPath(dt);
        }

        // 动画
        const newState = moved ? (this._running ? 'run' : 'walk') : 'idle';
        if (newState !== this._animState) {
            this._animState = newState;
            this._playAnim(newState);
        }

        if (moved) {
            const wp = this.node.worldPosition;
            bus.emit(WorldEvents.PLAYER_MOVE, { x: wp.x, z: wp.z });
        }
    }

    // ---- 点击寻路 ----

    private _onTap(e: any) {
        // 简化：由 UI 层 raycast 后调用 moveTo
    }

    /** 外部调用：移动到世界坐标 */
    moveTo(worldX: number, worldZ: number) {
        const wp = this.node.worldPosition;
        this._path = navGrid.findPath(wp.x, wp.z, worldX, worldZ);
        this._pathIndex = 0;
        this._followingPath = this._path.length > 1;
        if (this._followingPath) {
            this._pathIndex = 1; // 跳过起点
        }
    }

    private _followPath(dt: number): boolean {
        if (this._pathIndex >= this._path.length) {
            this._followingPath = false;
            bus.emit(WorldEvents.PLAYER_STOP, undefined as any);
            return false;
        }

        const target = this._path[this._pathIndex];
        const wp = this.node.worldPosition;
        const dx = target.x - wp.x;
        const dz = target.z - wp.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.2) {
            this._pathIndex++;
            if (this._pathIndex >= this._path.length) {
                this._followingPath = false;
                bus.emit(WorldEvents.PLAYER_STOP, undefined as any);
                return false;
            }
            return true;
        }

        const step = this._speed * dt;
        const ratio = Math.min(step / dist, 1);
        _tmpV3.set(dx * ratio, 0, dz * ratio);
        this._tryMove(_tmpV3);
        this._faceDirection(dx, dz);
        return true;
    }

    private _tryMove(delta: Vec3) {
        const wp = this.node.worldPosition;
        const nx = wp.x + delta.x;
        const nz = wp.z + delta.z;

        // 简单碰撞检查
        if (!navGrid.isBlocked(Math.round(nx), Math.round(nz))) {
            this.node.setWorldPosition(nx, wp.y, nz);
        } else {
            // 尝试滑墙：分别检查 X 和 Z
            if (!navGrid.isBlocked(Math.round(nx), Math.round(wp.z))) {
                this.node.setWorldPosition(nx, wp.y, wp.z);
            } else if (!navGrid.isBlocked(Math.round(wp.x), Math.round(nz))) {
                this.node.setWorldPosition(wp.x, wp.y, nz);
            }
        }
    }

    private _faceDirection(dx: number, dz: number) {
        if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return;
        const angle = Math.atan2(dx, dz) * 180 / Math.PI;
        this.node.setRotationFromEuler(0, angle, 0);
    }

    private _playAnim(state: string) {
        if (!this.anim) return;
        const clipName = state === 'idle' ? 'idle' : (state === 'run' ? 'run' : 'walk');
        this.anim.play(clipName);
    }
}