package attachment

import "testing"

func TestGetStreakMessage(t *testing.T) {
	tests := []struct{ streak int; contains string }{
		{1, "第一天"}, {3, "连续3天"}, {7, "一周"}, {14, "两周"}, {30, "一个月"}, {100, "百天"}, {200, "200天连续"},
	}
	for _, tt := range tests {
		msg := getStreakMessage(tt.streak)
		if msg == "" { t.Errorf("streak %d: expected non-empty message", tt.streak) }
	}
}

func TestBuildReunionScene(t *testing.T) {
	scenes := []float64{2, 12, 48, 100, 200}
	for _, h := range scenes {
		scene, emoji, msg := buildReunionScene(h)
		if scene == "" || emoji == "" || msg == "" {
			t.Errorf("hours %.0f: empty fields scene=%q emoji=%q", h, scene, emoji)
		}
	}
}
