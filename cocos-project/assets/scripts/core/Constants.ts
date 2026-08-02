/**
 * 全局常量 — 世界尺寸、性能阈值、chunk 参数
 */

// ---- Chunk ----
export const CHUNK_SIZE = 16;           // 单 chunk = 16×16 tiles
export const TILE_SIZE = 1.0;           // 单 tile = 1m
export const CHUNK_WORLD_SIZE = CHUNK_SIZE * TILE_SIZE; // 16m

// ---- 加载半径 ----
export const LOAD_RADIUS_P0 = 0;        // 当前 chunk
export const LOAD_RADIUS_P1 = 1;        // 相邻 8 chunks
export const LOAD_RADIUS_P2 = 2;        // 再外圈 16 chunks
export const MAX_LOADED_CHUNKS = 25;    // LRU 上限

// ---- 相机 ----
export const CAM_ORTH_SIZE_DEFAULT = 10;
export const CAM_ORTH_SIZE_MIN = 8;
export const CAM_ORTH_SIZE_MAX = 15;
export const CAM_ELEVATION = 35;        // 俯角
export const CAM_AZIMUTH = 45;          // 旋转角（固定）
export const CAM_FOLLOW_LERP = 0.1;

// ---- 玩家 ----
export const PLAYER_WALK_SPEED = 3.0;   // m/s
export const PLAYER_RUN_SPEED = 5.0;
export const PET_FOLLOW_DIST = 2.0;     // m

// ---- 性能分级阈值 ----
export const PERF_HIGH_FPS = 50;
export const PERF_MID_FPS = 30;
// 低于 PERF_MID_FPS → LOW

// ---- 世界 ----
export const WORLD_CHUNKS_X = 22;
export const WORLD_CHUNKS_Z = 22;

// ---- 区域过渡 ----
export const ZONE_TRANSITION_DURATION = 2.0; // 秒

// ---- 资源 ----
export const REMOTE_ASSET_BASE = '';    // 构建时注入 CDN 地址