package journal

import (
	"testing"
)

func TestFallbackEmotion(t *testing.T) {
	tests := []struct {
		content  string
		expected string
	}{
		{"今天很开心", "happy"},
		{"好难过啊", "sad"},
		{"好累好累不想动了", "tired"},
		{"好紧张好焦虑", "anxious"},
		{"太激动了", "excited"},
		{"今天天气不错", "calm"},
	}

	for _, tc := range tests {
		j := &Journal{Content: tc.content}
		got := j.fallbackEmotion()
		if got != tc.expected {
			t.Errorf("fallbackEmotion(%q) = %q, want %q", tc.content, got, tc.expected)
		}
	}
}

func TestContainsAny(t *testing.T) {
	if !containsAny("我好开心啊", []string{"开心", "高兴"}) {
		t.Error("should match '开心'")
	}
	if containsAny("今天天气好", []string{"开心", "难过"}) {
		t.Error("should not match")
	}
}

func TestMin(t *testing.T) {
	if min(3, 5) != 3 {
		t.Error("min(3,5) should be 3")
	}
	if min(10, 2) != 2 {
		t.Error("min(10,2) should be 2")
	}
}
