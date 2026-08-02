package social

import "testing"

func TestNewService(t *testing.T) { if NewService(nil) == nil { t.Fatal("nil") } }

func TestAddFriend_Self(t *testing.T) {
	r, _ := NewService(nil).AddFriend(t.Context(), "u1", "u1")
	if r != nil { t.Error("expected nil when friending self") }
}
func TestRemoveFriend(t *testing.T) {
	_ = NewService(nil).RemoveFriend(t.Context(), "u1", "u2")
}
func TestGetFeed_NilPool(t *testing.T) {
	f, _ := NewService(nil).GetFeed(t.Context(), "u1")
	if f != nil && len(f) > 0 { t.Log("feed returned", len(f), "items") }
}
