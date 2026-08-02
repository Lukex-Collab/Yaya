import { _decorator } from 'cc';

/**
 * 类型化事件总线 — 世界核心与功能模块的唯一通信通道。
 * WorldCore 不 import 任何 Feature，所有跨模块通信走这里。
 */

// ---- 事件名常量（集中定义，避免拼写错误）----
export const WorldEvents = {
    // 世界生命周期
    WORLD_READY:        'world:ready',
    WORLD_PAUSE:        'world:pause',
    WORLD_RESUME:       'world:resume',

    // Chunk
    CHUNK_LOADED:       'chunk:loaded',
    CHUNK_UNLOADED:     'chunk:unloaded',
    CHUNK_CHANGE:       'chunk:change',       // 玩家所在 chunk 变化

    // 区域
    ZONE_ENTER:         'zone:enter',
    ZONE_LEAVE:         'zone:leave',
    ZONE_TRANSITION:    'zone:transition',     // 过渡动画进行中

    // 玩家
    PLAYER_MOVE:        'player:move',
    PLAYER_STOP:        'player:stop',
    PLAYER_INTERACT:    'player:interact',

    // 宠物
    PET_STATE_CHANGE:   'pet:state',

    // 性能
    PERF_GRADE_CHANGED: 'perf:grade',

    // 功能模块通用
    FEATURE_ENABLED:    'feature:enabled',
    FEATURE_DISABLED:   'feature:disabled',

    // 交互（预留给后续功能）
    INTERACT_TRIGGER:   'interact:trigger',
    INTERACT_END:       'interact:end',
    DIALOGUE_START:     'dialogue:start',
    DIALOGUE_END:       'dialogue:end',
} as const;

export type WorldEventName = typeof WorldEvents[keyof typeof WorldEvents];

// ---- 事件载荷类型映射 ----
export interface WorldEventPayloads {
    [WorldEvents.WORLD_READY]:        void;
    [WorldEvents.WORLD_PAUSE]:        void;
    [WorldEvents.WORLD_RESUME]:       void;
    [WorldEvents.CHUNK_LOADED]:       { cx: number; cz: number };
    [WorldEvents.CHUNK_UNLOADED]:     { cx: number; cz: number };
    [WorldEvents.CHUNK_CHANGE]:       { from: { cx: number; cz: number }; to: { cx: number; cz: number } };
    [WorldEvents.ZONE_ENTER]:         { zoneId: string };
    [WorldEvents.ZONE_LEAVE]:         { zoneId: string };
    [WorldEvents.ZONE_TRANSITION]:    { fromZone: string; toZone: string; progress: number };
    [WorldEvents.PLAYER_MOVE]:        { x: number; z: number };
    [WorldEvents.PLAYER_STOP]:        void;
    [WorldEvents.PLAYER_INTERACT]:    { targetId: string };
    [WorldEvents.PET_STATE_CHANGE]:   { state: string };
    [WorldEvents.PERF_GRADE_CHANGED]: { grade: 'HIGH' | 'MID' | 'LOW' };
    [WorldEvents.FEATURE_ENABLED]:    { featureId: string };
    [WorldEvents.FEATURE_DISABLED]:   { featureId: string };
    [WorldEvents.INTERACT_TRIGGER]:   { targetId: string; type: string };
    [WorldEvents.INTERACT_END]:       { targetId: string };
    [WorldEvents.DIALOGUE_START]:     { npcId: string };
    [WorldEvents.DIALOGUE_END]:       { npcId: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
    private _listeners: Map<string, Set<Handler<any>>> = new Map();

    on<K extends WorldEventName>(event: K, handler: Handler<WorldEventPayloads[K]>): void {
        let set = this._listeners.get(event);
        if (!set) { set = new Set(); this._listeners.set(event, set); }
        set.add(handler);
    }

    off<K extends WorldEventName>(event: K, handler: Handler<WorldEventPayloads[K]>): void {
        this._listeners.get(event)?.delete(handler);
    }

    emit<K extends WorldEventName>(event: K, payload: WorldEventPayloads[K]): void {
        const set = this._listeners.get(event);
        if (!set) return;
        for (const fn of set) {
            try { fn(payload); } catch (e) { console.error(`[EventBus] error in ${event}:`, e); }
        }
    }

    /** 一次性监听 */
    once<K extends WorldEventName>(event: K, handler: Handler<WorldEventPayloads[K]>): void {
        const wrapper: Handler<WorldEventPayloads[K]> = (p) => {
            this.off(event, wrapper);
            handler(p);
        };
        this.on(event, wrapper);
    }

    /** 清除某事件所有监听（模块 dispose 时调用） */
    clear(event?: WorldEventName): void {
        if (event) { this._listeners.delete(event); }
        else { this._listeners.clear(); }
    }

    listenerCount(event: WorldEventName): number {
        return this._listeners.get(event)?.size ?? 0;
    }
}

/** 全局单例 */
export const bus = new EventBus();