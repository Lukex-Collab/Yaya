import { request } from './request';
import type { LoginResponse, User } from '../typings/api';

export function wechatLogin(code: string, nickname?: string, avatarUrl?: string) {
  return request<LoginResponse>('/auth/wechat/login', {
    method: 'POST',
    auth: false,
    data: { code, nickname, avatar_url: avatarUrl },
  });
}

export function getProfile() {
  return request<User>('/user/profile');
}

export function updateProfile(data: {
  nickname?: string;
  yaya_nickname?: string;
  avatar_url?: string;
}) {
  return request<User>('/user/profile', { method: 'PUT', data });
}
