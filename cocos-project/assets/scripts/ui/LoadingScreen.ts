import { _decorator, Component, Node, Label, ProgressBar, Tween, tween, UIOpacity } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 加载屏 — 远程资源加载时显示 Low-Poly 占位 + 进度 + 治愈系动画。
 */
@ccclass('LoadingScreen')
export class LoadingScreen extends Component {

    @property(Label)
    tipLabel: Label | null = null;

    @property(ProgressBar)
    progressBar: ProgressBar | null = null;

    @property(Node)
    animNode: Node | null = null;   // 治愈系 loading 动画节点

    @property(UIOpacity)
    uiOpacity: UIOpacity | null = null;

    private _tips = [
        '灵伴正在整理花瓣…',
        '星砂在海风中闪烁…',
        '萤火虫在等你哦…',
        '云杉林里传来鸟鸣…',
        '月光石在微微发光…',
    ];

    onLoad() {
        this._rotateTips();
        this._startAnim();
    }

    /** 更新进度 0-1 */
    setProgress(p: number) {
        if (this.progressBar) {
            this.progressBar.progress = Math.min(1, Math.max(0, p));
        }
    }

    /** 隐藏加载屏（淡出） */
    hide(duration: number = 0.5) {
        if (this.uiOpacity) {
            tween(this.uiOpacity)
                .to(duration, { opacity: 0 })
                .call(() => { this.node.active = false; })
                .start();
        } else {
            this.node.active = false;
        }
    }

    /** 显示加载屏 */
    show() {
        this.node.active = true;
        if (this.uiOpacity) {
            this.uiOpacity.opacity = 255;
        }
    }

    private _tipIndex = 0;
    private _rotateTips() {
        if (!this.tipLabel) return;
        this.tipLabel.string = this._tips[this._tipIndex];
        this._tipIndex = (this._tipIndex + 1) % this._tips.length;
        this.scheduleOnce(() => this._rotateTips(), 3);
    }

    private _startAnim() {
        if (!this.animNode) return;
        // 简单旋转/缩放呼吸动画
        tween(this.animNode)
            .repeatForever(
                tween(this.animNode)
                    .to(1.5, { scale: new (this.animNode.scale.constructor as any)(1.05, 1.05, 1) })
                    .to(1.5, { scale: new (this.animNode.scale.constructor as any)(0.95, 0.95, 1) })
            )
            .start();
    }
}