package push

import "testing"

func TestNewService(t *testing.T) {
	if NewService(nil, nil) == nil { t.Fatal("nil") }
}
func TestUnreadCount_NilPool(t *testing.T) {
	c, err := NewService(nil, nil).UnreadCount(t.Context(), "u1")
	if err != nil || c != 0 { t.Errorf("expected 0,nil: %d,%v", c, err) }
}
func TestGenerateGreeting_NoClient(t *testing.T) {
	g := NewService(nil, nil).generateMorningGreeting(t.Context(), "小美", "牙牙")
	if g == "" { t.Error("expected fallback greeting") }
}
