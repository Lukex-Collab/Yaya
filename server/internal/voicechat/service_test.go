package voicechat

import "testing"

func TestNewService(t *testing.T) { if NewService(nil, nil) == nil { t.Fatal("nil") } }
func TestGetCallStatus_NoPool(t *testing.T) {
	s, _ := NewService(nil, nil).GetCallStatus(t.Context(), "u1")
	if s == nil || !s.CanCall { t.Error("expected can_call=true") }
}
func TestEndCall_NoPool(t *testing.T) { NewService(nil, nil).EndCall(t.Context(), "u1") }
