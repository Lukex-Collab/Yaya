import { _decorator, Component, Node, Vec3, SkeletalAnimation } from 'cc';
import { bus, WorldEvents } from '../core/EventBus';
import { PET_FOLLOW_DIST } from '../core/Constants';

const { ccclass, property } = _decorator;

/**
 * 宠物跟随 — 基础行为树：跟随 / 待机 / 嗅探。
 * MVP 只做跟随 + 简单随机行为。
 */
@ccclass('PetFollower')
export class PetFollower extends Component {

    @property(Node)
    target: Node | null = null;   // 跟随目标（玩家）

    @property(SkeletalAnimation)
    anim: SkeletalAnimation | null = null;

    @property
    followDist: number = PET_FOLLOW_DIST;

    private _state: 'follow' | 'idle' | 'sniff' = 'follow';
    private _stateTimer = 0;
    private _sniffTarget = new Vec3();
    private _lerpSpeed = 3.0;

    update(dt: number) {
        if (!this.target) return;

        this._stateTimer -= dt;
        const tp = this.target.worldPosition;
        const mp = this.node.worldPosition;
        const dx = tp.x - mp.x;
        const dz = tp.z - mp.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        switch (this._state) {
            case 'follow':
                if (dist > this.followDist) {
                    // 朝玩家走
                    const speed = Math.min(dist * this._lerpSpeed, 4.0) * dt;
                    const ratio = speed / dist;
                    const nx = mp.x + dx * ratio;
                    const nz = mp.z + dz * ratio;
                    this.node.setWorldPosition(nx, mp.y, nz);
                    this._faceDir(dx, dz);
                    this._setAnim('walk');
                } else {
                    this._setAnim('idle');
                    // 随机切换到嗅探
                    if (this._stateTimer <= 0 && Math.random() < 0.3) {
                        this._state = 'sniff';
                        this._stateTimer = 2 + Math.random() * 3;
                        // 随机偏移
                        this._sniffTarget.set(
                            mp.x + (Math.random() - 0.5) * 3,
                            mp.y,
                            mp.z + (Math.random() - 0.5) * 3,
                        );
                        bus.emit(WorldEvents.PET_STATE_CHANGE, { state: 'sniff' });
                    }
                }
                break;

            case 'sniff':
                // 朝嗅探点走
                const sdx = this._sniffTarget.x - mp.x;
                const sdz = this._sniffTarget.z - mp.z;
                const sdist = Math.sqrt(sdx * sdx + sdz * sdz);
                if (sdist > 0.3) {
                    const ss = Math.min(sdist * 2, 2.0) * dt;
                    const sr = ss / sdist;
                    this.node.setWorldPosition(mp.x + sdx * sr, mp.y, mp.z + sdz * sr);
                    this._faceDir(sdx, sdz);
                    this._setAnim('walk');
                } else {
                    this._setAnim('idle');
                }
                if (this._stateTimer <= 0 || dist > this.followDist * 2) {
                    this._state = 'follow';
                    this._stateTimer = 3 + Math.random() * 5;
                    bus.emit(WorldEvents.PET_STATE_CHANGE, { state: 'follow' });
                }
                break;

            case 'idle':
                this._setAnim('idle');
                if (this._stateTimer <= 0 || dist > this.followDist) {
                    this._state = 'follow';
                    this._stateTimer = 3 + Math.random() * 5;
                }
                break;
        }
    }

    private _faceDir(dx: number, dz: number) {
        if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return;
        const angle = Math.atan2(dx, dz) * 180 / Math.PI;
        this.node.setRotationFromEuler(0, angle, 0);
    }

    private _animState = '';
    private _setAnim(name: string) {
        if (name === this._animState || !this.anim) return;
        this._animState = name;
        this.anim.play(name);
    }
}