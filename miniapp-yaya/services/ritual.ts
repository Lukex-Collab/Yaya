import { request } from './request';

export function goodMorning() {
  return request<{ greeting: string }>('/ritual/good-morning', { method: 'POST' });
}

export function goodNight() {
  return request<{ greeting: string }>('/ritual/good-night', { method: 'POST' });
}

export function bedtimeStory() {
  return request<{ story: string }>('/ritual/bedtime-story');
}
