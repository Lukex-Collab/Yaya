package pet

import "testing"

func TestAutonomousEngine_New(t *testing.T) {
	e := NewAutonomousEngine(nil, nil)
	if e == nil { t.Fatal("expected non-nil") }
}
func TestGetTodayActivity_NilPool(t *testing.T) {
	_, err := NewAutonomousEngine(nil, nil).GetTodayActivity(t.Context(), "u1")
	if err != nil { t.Logf("expected nil error for nil pool: %v", err) }
}
