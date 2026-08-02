package safety

import (
	"testing"
)

func TestNewService(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Error("NewService should not return nil")
	}
	if svc.sim == nil {
		t.Error("service should auto-create BLE simulator")
	}
}

func TestGetStatusSimulated(t *testing.T) {
	svc := NewService(nil)
	status, err := svc.GetStatus(t.Context(), "test-user")
	if err != nil {
		t.Fatalf("GetStatus should not error: %v", err)
	}
	if status["mode"] != "simulated" {
		t.Errorf("expected simulated mode, got %v", status["mode"])
	}
	if status["all_safe"] != true {
		t.Error("expected all_safe=true initially")
	}
	devices, ok := status["devices"]
	if !ok {
		t.Error("expected devices list in status")
	}
	deviceList := devices.([]map[string]interface{})
	if len(deviceList) != 4 {
		t.Errorf("expected 4 devices, got %d", len(deviceList))
	}
}

func TestGetHistory(t *testing.T) {
	svc := NewService(nil)
	// Record an alert first
	svc.RecordAlert(t.Context(), "test-user", "test", "dev_001", map[string]interface{}{"msg": "test"})
	// Get history (should work even without DB)
	logs, err := svc.GetHistory(t.Context(), "test-user", 10)
	if err != nil {
		t.Fatalf("GetHistory should not error: %v", err)
	}
	// Without DB, logs may be empty - that's OK
	_ = logs
}

func TestRecordAlert(t *testing.T) {
	svc := NewService(nil)
	err := svc.RecordAlert(t.Context(), "test-user", "front_door_open", "dev_001", map[string]interface{}{
		"message": "前门被打开了！",
	})
	if err != nil {
		t.Fatalf("RecordAlert should not error with nil pool: %v", err)
	}
}
