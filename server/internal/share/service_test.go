package share

import "testing"

func TestGenerateJournalCard(t *testing.T) {
	c, err := NewService().GenerateJournalCard(t.Context(), "u1", "j1")
	if err != nil || c == nil { t.Fatal("expected non-nil") }
	if c.Type != "journal" { t.Errorf("expected journal, got %s", c.Type) }
}
func TestGenerateAchievementCard(t *testing.T) {
	c, _ := NewService().GenerateAchievementCard(t.Context(), "u1", "first_chat")
	if c == nil || c.SharedURL == "" { t.Error("expected shared URL") }
}
func TestGenerateEmotionReportCard(t *testing.T) {
	c, _ := NewService().GenerateEmotionReportCard(t.Context(), "u1")
	if c == nil || c.Type != "emotion_report" { t.Error("bad type") }
}
