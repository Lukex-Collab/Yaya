package voiceclone

import "testing"

func TestNewService(t *testing.T) { if NewService(nil, "") == nil { t.Fatal("nil") } }
func TestCheckCloneStatus_NoPool(t *testing.T) {
	s, _ := NewService(nil, "").CheckCloneStatus(t.Context(), "u1")
	if s == nil || s["status"] == "" { t.Error("expected status") }
}
