import { request } from './request';

export function getSafetyStatus() {
  return request<{
    mode: string; door_ok: boolean; window_ok: boolean;
    motion: string; last_check: string;
  }>('/safety/status');
}

export function getSafetyHistory() {
  return request<Array<{
    id: string; event_type: string; device_id: string;
    is_simulated: boolean; created_at: string;
  }>>('/safety/history');
}
