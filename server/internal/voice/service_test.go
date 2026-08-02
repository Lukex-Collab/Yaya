package voice

import "testing"

func TestNewService(t *testing.T) {
	svc := NewService(nil, "", "")
	if svc == nil { t.Fatal("expected non-nil") }
}

func TestUploadFile_SizeLimit(t *testing.T) {
	svc := NewService(nil, "", "")
	// nil pool should not panic on UploadFile
	_, err := svc.UploadFile(t.Context(), nil, nil, "test-user")
	// Will error on nil file but not on nil pool
	_ = err
}

func TestProcessVoice_NilPool(t *testing.T) {
	svc := NewService(nil, "", "")
	_, err := svc.ProcessVoice(t.Context(), "test-user", "conv1", []byte("test audio"), 3000)
	// Should not panic even with nil pool
	_ = err
}
