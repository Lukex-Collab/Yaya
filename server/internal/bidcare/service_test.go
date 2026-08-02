package bidcare

import "testing"

func TestGetYayaStatus_NoPool(t *testing.T) {
	svc := NewService(nil)
	status, err := svc.GetYayaStatus(t.Context(), "test-user")
	if err != nil || status == nil { t.Fatal("expected non-nil status") }
	if status.Happiness < 0 || status.Happiness > 100 { t.Error("happiness out of range") }
	if status.Mood == "" { t.Error("expected non-empty mood") }
}

func TestTendToYaya_InvalidAction(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.TendToYaya(t.Context(), "test-user", "invalid_action")
	if err == nil { t.Error("expected error for invalid action") }
}

func TestYayaConcerns_HasFallbacks(t *testing.T) {
	svc := NewService(nil)
	concerns, err := svc.GetYayaConcerns(t.Context(), "test-user")
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if len(concerns) == 0 { t.Error("expected at least fallback concerns") }
}

func TestGetMutualCareReport(t *testing.T) {
	svc := NewService(nil)
	report, err := svc.GetMutualCareReport(t.Context(), "test-user")
	if err != nil || report == nil { t.Fatal("expected non-nil report") }
	if report.CareBalance == "" { t.Error("expected non-empty care balance") }
}
