import { API_BASE } from '../config/api';
import type { StreamEvent } from '../typings/api';

const getToken = (): string => wx.getStorageSync('token') || '';

export function sendMessage(
  content: string,
  conversationId: string,
  onChunk: (event: StreamEvent) => void,
  onError: (error: Error) => void
): WechatMiniprogram.RequestTask {
  const task = wx.request({
    url: `${API_BASE}/chat/send`,
    method: 'POST',
    enableChunked: true,
    header: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    data: { content, conversation_id: conversationId || '' },
    success() {},
    fail(err) {
      onError(new Error(err.errMsg));
    },
  });

  // 监听流式响应
  let buffer = '';
  task.onChunkReceived((res: any) => {
    buffer += res.data;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          onChunk(event);
        } catch {}
      }
    }
  });

  return task;
}

export function getHistory(page = 1, pageSize = 20) {
  const { request } = require('./request');
  return request<Array<{ id: string; title: string; mood: string; message_count: number; started_at: string }>>(
    `/chat/history?page=${page}&page_size=${pageSize}`
  );
}

export function deleteConversation(id: string) {
  const { request } = require('./request');
  return request<{ deleted: boolean }>(`/chat/history/${id}`, { method: 'DELETE' });
}
