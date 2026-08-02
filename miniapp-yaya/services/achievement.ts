import { request } from './request';
import type { UserAchievement } from '../typings/api';

export function getAchievements() {
  return request<UserAchievement[]>('/achievement/list');
}
