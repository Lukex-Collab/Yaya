export interface User {
  id: string;
  wechat_openid: string;
  nickname: string;
  avatar_url?: string;
  yaya_nickname: string;
  yaya_personality_seed: number;
  companion_days: number;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  is_new: boolean;
}

export interface StreamEvent {
  content?: string;
  done: boolean;
  conv_id?: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  mood: string;
  message_count: number;
  started_at: string;
}

export interface Journal {
  id: string;
  title: string;
  content: string;
  emotion: string;
  emotion_score: number;
  weather: string;
  is_private: boolean;
  word_count: number;
  created_at: string;
}

export interface Memory {
  id: string;
  content: string;
  summary: string;
  importance: number;
  memory_type: string;
  created_at: string;
}

export interface UserAchievement {
  code: string;
  name: string;
  description: string;
  icon_emoji: string;
  category: string;
  tier: number;
  progress: number;
  target: number;
  unlocked_at?: string;
}

export interface MoodStats {
  happy: number;
  sad: number;
  anxious: number;
  calm: number;
  excited: number;
  tired: number;
}
