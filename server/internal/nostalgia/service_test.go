package nostalgia

import "testing"

func TestNewService(t *testing.T) { if NewService(nil) == nil { t.Fatal("nil") } }
func TestGetTodayInHistory_NoPool(t *testing.T) {
	m, _ := NewService(nil).GetTodayInHistory(t.Context(), "u1")
	if m == nil || m.Title == "" { t.Error("expected fallback") }
}
func TestGetRandomHighlight(t *testing.T) {
	m, _ := NewService(nil).GetRandomHighlight(t.Context(), "u1")
	if m == nil || m.Title == "" { t.Error("expected highlight") }
}
func TestGetStats_NoPool(t *testing.T) {
	s, _ := NewService(nil).GetStats(t.Context(), "u1")
	if s == nil { t.Fatal("nil") }
}
