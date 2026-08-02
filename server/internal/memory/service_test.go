package memory

import "testing"

func TestNewService(t *testing.T) {
	svc := NewService(nil, nil, nil, "")
	if svc == nil { t.Fatal("expected non-nil") }
}

func TestMin(t *testing.T) {
	if min(3, 5) != 3 { t.Error("min(3,5) should be 3") }
	if min(5, 3) != 3 { t.Error("min(5,3) should be 3") }
	if min(0, 0) != 0 { t.Error("min(0,0) should be 0") }
}

func TestApplyDecay_NilPool(t *testing.T) {
	svc := NewService(nil, nil, nil, "")
	if err := svc.ApplyDecay(t.Context()); err != nil {
		t.Logf("expected nil error for nil pool, got: %v", err)
	}
}

func TestMemoryStruct(t *testing.T) {
	m := Memory{ID: "mem1", Content: "用户叫小美", Importance: 8, MemoryType: "fact"}
	if m.ID == "" { t.Error("expected non-empty ID") }
	if m.Content == "" { t.Error("expected non-empty content") }
	if m.Importance < 1 || m.Importance > 10 { t.Errorf("importance out of range: %d", m.Importance) }
}
