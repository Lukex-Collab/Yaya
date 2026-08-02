package hardware

import "testing"

func TestGlobalDeviceInitialState(t *testing.T) {
	d := GlobalDevice
	if d.Temperature < 36 || d.Temperature > 40 { t.Errorf("temp out of range: %.1f", d.Temperature) }
	if d.Battery < 0 || d.Battery > 100 { t.Errorf("battery out of range: %d", d.Battery) }
	if d.FirmwareVersion == "" { t.Error("expected firmware version") }
}

func TestTouchPatterns(t *testing.T) {
	d := &SimulatedDevice{Temperature: 37.2, Battery: 85, Volume: 5}
	d.Touch()
	if d.TouchCount != 1 { t.Errorf("expected touch count 1, got %d", d.TouchCount) }
	d.Touch(); d.Touch(); d.Touch()
	if d.TouchCount != 4 { t.Errorf("expected touch count 4, got %d", d.TouchCount) }
}

func TestHoldRelease(t *testing.T) {
	d := &SimulatedDevice{Temperature: 37.2, Battery: 85}
	d.Hold()
	if !d.IsHeld { t.Error("expected held=true") }
	if d.Temperature <= 37.2 { t.Error("temp should rise when held") }
	d.Release()
	if d.IsHeld { t.Error("expected held=false after release") }
}

func TestMaxMin(t *testing.T) {
	if max(3, 5) != 5 { t.Error("max broken") }
	if min(3, 5) != 3 { t.Error("min broken") }
}
