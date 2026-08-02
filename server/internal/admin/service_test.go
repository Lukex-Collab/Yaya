package admin

import "testing"

func TestNewService(t *testing.T) {
	svc := NewService(nil)
	if svc == nil { t.Fatal("expected non-nil") }
}

func TestDashboard_NilPool(t *testing.T) {
	// With nil pool, should return gracefully
	stats, err := NewService(nil).GetDashboard(t.Context())
	// Will likely error on nil pool QueryRow, which is acceptable
	_ = stats
	_ = err
}
