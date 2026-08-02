import { _decorator, Component, director, game } from 'cc';
import { bus, WorldEvents } from './EventBus';
import { PERF_HIGH_FPS, PERF_MID_FPS } from './Constants';

const { ccclass } = _decorator;

export type PerfGrade = 'HIGH' | 'MID' | 'LOW';

/**
 * 性能分级器 — 采样帧率，输出 HIGH/MID/LOW 三档。
 * 挂载到场景常驻节点，自动采样。
 */
@ccclass('PerfGrader')
export class PerfGrader extends Component {

    private _grade: PerfGrade = 'MID';
    private _frameTimes: number[] = [];
    private _sampleWindow = 60;      // 采样帧数
    private _checkInterval = 3.0;    // 每 3 秒评估一次
    private _timer = 0;
    private _lastTime = 0;

    get grade(): PerfGrade { return this._grade; }

    onLoad() {
        this._lastTime = performance.now();
    }

    update(dt: number) {
        const now = performance.now();
        const frameMs = now - this._lastTime;
        this._lastTime = now;

        this._frameTimes.push(frameMs);
        if (this._frameTimes.length > this._sampleWindow) {
            this._frameTimes.shift();
        }

        this._timer += dt;
        if (this._timer >= this._checkInterval && this._frameTimes.length >= 30) {
            this._timer = 0;
            this._evaluate();
        }
    }

    private _evaluate() {
        const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
        const fps = 1000 / avg;

        let newGrade: PerfGrade;
        if (fps >= PERF_HIGH_FPS) newGrade = 'HIGH';
        else if (fps >= PERF_MID_FPS) newGrade = 'MID';
        else newGrade = 'LOW';

        if (newGrade !== this._grade) {
            this._grade = newGrade;
            bus.emit(WorldEvents.PERF_GRADE_CHANGED, { grade: newGrade });
            console.log(`[PerfGrader] grade -> ${newGrade} (avg fps: ${fps.toFixed(1)})`);
        }
    }

    /** 手动设置（调试用） */
    setGrade(g: PerfGrade) {
        this._grade = g;
        bus.emit(WorldEvents.PERF_GRADE_CHANGED, { grade: g });
    }
}