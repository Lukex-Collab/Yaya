package safety

import (
	"context"
	"testing"
	"time"
)

func TestNewBLESimulator(t *testing.T) {
	sim := NewBLESimulator(nil)
	if sim == nil {
		t.Fatal("expected non-nil simulator")
	}
	if len(sim.devices) != 4 {
		t.Errorf("expected 4 default devices, got %d", len(sim.devices))
	}
}

func TestDefaultDevices(t *testing.T) {
	sim := NewBLESimulator(nil)

	// 验证所有设备都有值
	for id, dev := range sim.devices {
		if dev.Name == "" {
			t.Errorf("device %s has empty name", id)
		}
		if dev.Type == "" {
			t.Errorf("device %s has empty type", id)
		}
		if dev.Battery < 0 || dev.Battery > 100 {
			t.Errorf("device %s has invalid battery: %d", id, dev.Battery)
		}
	}
}

func TestIsAllSafe_Initially(t *testing.T) {
	sim := NewBLESimulator(nil)
	safe, msg := sim.IsAllSafe()

	if !safe {
		t.Errorf("expected all safe, got: %s", msg)
	}
}

func TestDeviceAlert_MakesUnsafe(t *testing.T) {
	sim := NewBLESimulator(nil)

	// 触发告警
	sim.triggerEvent("dev_001", "alert")

	safe, msg := sim.IsAllSafe()
	if safe {
		t.Error("expected unsafe after alert trigger")
	}
	if msg == "" {
		t.Error("expected non-empty safety message")
	}
}

func TestGetDevices_ReturnsCopy(t *testing.T) {
	sim := NewBLESimulator(nil)
	devices := sim.GetDevices()

	if len(devices) != 4 {
		t.Errorf("expected 4 devices, got %d", len(devices))
	}

	// 修改返回的拷贝不应影响原始
	devices["dev_001"].Battery = 0
	orig, _ := sim.GetDevice("dev_001")
	if orig.Battery == 0 {
		t.Error("GetDevices should return a copy, not reference")
	}
}

func TestGetDevice_NotFound(t *testing.T) {
	sim := NewBLESimulator(nil)
	_, err := sim.GetDevice("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent device")
	}
}

func TestOpenCloseSequence(t *testing.T) {
	sim := NewBLESimulator(nil)

	// 开门
	sim.triggerEvent("dev_001", "open")
	dev, _ := sim.GetDevice("dev_001")
	if !dev.IsOpen {
		t.Error("expected device to be open")
	}

	// 关门
	sim.triggerEvent("dev_001", "close")
	dev, _ = sim.GetDevice("dev_001")
	if dev.IsOpen {
		t.Error("expected device to be closed")
	}

	// 应该恢复安全
	safe, _ := sim.IsAllSafe()
	if !safe {
		t.Error("expected safe after closing")
	}
}

func TestScenario_InvalidName(t *testing.T) {
	sim := NewBLESimulator(nil)
	err := sim.StartScenario(context.Background(), "invalid_scene")
	if err == nil {
		t.Error("expected error for invalid scenario name")
	}
}

func TestScenario_RunsEvents(t *testing.T) {
	sim := NewBLESimulator(nil)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 入侵测试场景会在10秒后触发open → alert
	err := sim.StartScenario(ctx, "intrusion_test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 等场景开始触发事件
	time.Sleep(50 * time.Millisecond)
	active := sim.GetActiveScenario()
	if active != "intrusion_test" {
		t.Errorf("expected active scenario 'intrusion_test', got '%s'", active)
	}
}

func TestEventChannel(t *testing.T) {
	sim := NewBLESimulator(nil)

	// 发送事件
	sim.triggerEvent("dev_001", "alert")

	// 检查事件通道
	select {
	case event := <-sim.EventChannel():
		if event.DeviceID != "dev_001" {
			t.Errorf("expected dev_001, got %s", event.DeviceID)
		}
		if event.Action != "alert" {
			t.Errorf("expected action 'alert', got '%s'", event.Action)
		}
		if event.Message == "" {
			t.Error("expected non-empty message")
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for event on channel")
	}
}

func TestBBuildAlertMessage(t *testing.T) {
	dev := &SimulatedDevice{ID: "dev_001", Name: "前门传感器", Type: DeviceFrontDoor}

	cases := []struct {
		action   string
		contains string
	}{
		{"open", "打开"},
		{"close", "关闭"},
		{"alert", "异常"},
		{"offline", "离线"},
		{"reconnect", "已重新连接"},
		{"battery_low", "电量低"},
	}

	for _, tc := range cases {
		msg := buildAlertMessage(dev, tc.action)
		if msg == "" {
			t.Errorf("action '%s' returned empty message", tc.action)
		}
	}
}
