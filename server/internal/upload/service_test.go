package upload

import (
	"strings"
	"testing"
)

func TestNewService(t *testing.T) {
	svc := NewService(nil, "./test-uploads", "http://localhost:8080")
	if svc == nil { t.Fatal("expected non-nil") }
	if svc.maxSize != 10*1024*1024 { t.Error("expected 10MB max size default") }
}

func TestUploadFile_SizeLimit(t *testing.T) {
	svc := NewService(nil, "./test-uploads", "http://localhost:8080")
	content := strings.Repeat("a", 11*1024*1024)
	_, err := svc.UploadFile(t.Context(), strings.NewReader(content), "test.jpg", int64(len(content)), "image/jpeg", "test-user")
	if err == nil { t.Error("expected size limit error") }
}

func TestUploadFile_UnsupportedType(t *testing.T) {
	svc := NewService(nil, "./test-uploads", "http://localhost:8080")
	_, err := svc.UploadFile(t.Context(), strings.NewReader("test"), "test.exe", 4, "application/octet-stream", "test-user")
	if err == nil { t.Error("expected unsupported type error") }
}

func TestUploadFile_ValidImage(t *testing.T) {
	svc := NewService(nil, "./test-uploads", "http://localhost:8080")
	result, err := svc.UploadFile(t.Context(), strings.NewReader("fakeimage"), "photo.jpg", 4, "image/jpeg", "test-user")
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if result.URL == "" { t.Error("expected non-empty URL") }
}

func TestMin(t *testing.T) {
	if min(3, 5) != 3 { t.Error("min broken") }
}
