const emotionMap: Record<string, { emoji: string; label: string; color: string }> = {
  happy:   { emoji: '😊', label: '开心', color: '#FFB347' },
  sad:     { emoji: '😢', label: '难过', color: '#8EB8FF' },
  anxious: { emoji: '😰', label: '焦虑', color: '#D4A8D6' },
  calm:    { emoji: '😌', label: '平静', color: '#7BC67E' },
  excited: { emoji: '🤩', label: '兴奋', color: '#FF8FA3' },
  tired:   { emoji: '😴', label: '疲惫', color: '#9B8B8B' },
  thinking: { emoji: '🤔', label: '思考中', color: '#9B8B8B' },
};

export function getEmotionInfo(emotion: string) {
  return emotionMap[emotion] || { emoji: '❓', label: '未知', color: '#9B8B8B' };
}

export function getEmotionColor(emotion: string): string {
  return getEmotionInfo(emotion).color;
}
