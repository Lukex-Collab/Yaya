import { request } from './request';

interface PeriodRecord {
  id: string; start_date: string; end_date?: string;
  cycle_length: number; symptoms: string[]; mood_note: string;
}

interface BodyNote {
  id: string; note_type: string; detail: string;
  severity: number; created_at: string;
}

export function recordPeriod(startDate: string) {
  return request<PeriodRecord>('/health/period/record', { method: 'POST', data: { start_date: startDate } });
}

export function getPeriodCalendar() {
  return request<PeriodRecord[]>('/health/period/calendar');
}

export function addBodyNote(noteType: string, detail: string, severity: number) {
  return request<BodyNote>('/health/body-note', { method: 'POST', data: { note_type: noteType, detail, severity } });
}

export function getBodyNotes() {
  return request<BodyNote[]>('/health/body-notes');
}
