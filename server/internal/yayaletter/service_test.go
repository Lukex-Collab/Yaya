package yayaletter

import "testing"

func TestNewService(t *testing.T) { if NewService(nil, nil) == nil { t.Fatal("nil") } }
func TestGeneratePS(t *testing.T) {
	for i := 0; i < 10; i++ {
		if generatePS() == "" { t.Error("expected PS") }
	}
}
func TestFormatHighlights(t *testing.T) {
	r := formatHighlights([]string{"test1", "test2"})
	if r == "" { t.Error("expected formatted") }
}
func TestGetMoodComment(t *testing.T) {
	if getMoodComment(5, 1, "牙牙") == "" { t.Error("empty") }
}
