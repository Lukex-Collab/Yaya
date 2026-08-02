package quest

import "testing"

func TestNewService(t *testing.T) {
	svc := NewService(nil)
	if svc == nil { t.Fatal("expected non-nil") }
}
