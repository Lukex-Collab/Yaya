import { request } from './request';
import type { Journal, MoodStats } from '../typings/api';

export function createJournal(content: string, isPrivate = false) {
  return request<Journal>('/journal/create', { method: 'POST', data: { content, is_private: isPrivate } });
}

export function getJournalList(emotion?: string) {
  const query = emotion ? `emotion=${emotion}` : '';
  return request<Journal[]>(`/journal/list?${query}`);
}

export function getJournalDetail(id: string) {
  return request<Journal>(`/journal/${id}`);
}

export function updateJournal(id: string, content: string) {
  return request<{ updated: boolean }>(`/journal/${id}`, { method: 'PUT', data: { content } });
}

export function deleteJournal(id: string) {
  return request<{ deleted: boolean }>(`/journal/${id}`, { method: 'DELETE' });
}

export function getMoodStats(period = '30 days') {
  return request<MoodStats>(`/journal/mood-stats?period=${encodeURIComponent(period)}`);
}
