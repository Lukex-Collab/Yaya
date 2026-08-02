package export

import "testing"

func TestExportUserData_NilPool(t *testing.T) {
	result, err := NewService(nil).ExportUserData(t.Context(), "u1")
	if err != nil || result == nil { t.Fatal("expected result") }
	if result.Status != "ready" { t.Errorf("expected ready, got %s", result.Status) }
}
func TestGetExportStatus(t *testing.T) {
	s, _ := NewService(nil).GetExportStatus(t.Context(), "u1")
	if s.Status == "" { t.Error("expected non-empty status") }
}
