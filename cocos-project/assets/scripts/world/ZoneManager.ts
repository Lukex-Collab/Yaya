import { _decorator, Component } from 'cc';
import { bus, WorldEvents } from '../core/EventBus';
import { CameraRig } from '../core/CameraRig';
import { CHUNK_WORLD_SIZE } from '../core/Constants';

const { ccclass, property } = _decorator;

/** 区域定义 */
export interface ZoneDef {
    id: string;
    name: string;
    chunkBounds: { minCX: number; maxCX: number; minCZ: number; maxCZ: number };
    ambientColor: [number, number, number];  // 色调覆盖 RGB 0-1
    fogDensity: number;
    fogColor: [number, number, number];
    ambientAudio: string;   // 环境音资源名
}

/**
 * 区域管理器 — 追踪玩家所在区域，触发进入/离开/过渡事件。
 */
@ccclass('ZoneManager')
export class ZoneManager extends Component {

    private _zones: ZoneDef[] = [];
    private _currentZoneId: string = '';

    /** 从配置加载区域定义 */
    loadZones(defs: ZoneDef[]) {
        this._zones = defs;
    }

    /** 每帧检查玩家所在区域 */
    tick(playerX: number, playerZ: number) {
        const { cx, cz } = CameraRig.worldToChunk(playerX, playerZ);
        const zone = this._findZone(cx, cz);
        const zoneId = zone?.id || '';

        if (zoneId !== this._currentZoneId) {
            const prev = this._currentZoneId;
            if (prev) {
                bus.emit(WorldEvents.ZONE_LEAVE, { zoneId: prev });
            }
            this._currentZoneId = zoneId;
            if (zoneId) {
                bus.emit(WorldEvents.ZONE_ENTER, { zoneId });
                bus.emit(WorldEvents.ZONE_TRANSITION, {
                    fromZone: prev || 'none',
                    toZone: zoneId,
                    progress: 0,
                });
            }
        }
    }

    get currentZone(): ZoneDef | undefined {
        return this._zones.find(z => z.id === this._currentZoneId);
    }

    get currentZoneId(): string { return this._currentZoneId; }

    getZone(id: string): ZoneDef | undefined {
        return this._zones.find(z => z.id === id);
    }

    private _findZone(cx: number, cz: number): ZoneDef | undefined {
        for (const z of this._zones) {
            const b = z.chunkBounds;
            if (cx >= b.minCX && cx <= b.maxCX && cz >= b.minCZ && cz <= b.maxCZ) {
                return z;
            }
        }
        return undefined;
    }
}