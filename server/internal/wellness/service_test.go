package wellness

import "testing"

func TestNewService(t *testing.T) { if NewService(nil, nil) == nil { t.Fatal("nil") } }

func TestDefaultReplies(t *testing.T) {
	for score := 1; score <= 5; score++ {
		if defaultReplies[score] == "" { t.Errorf("score %d: expected non-empty reply", score) }
	}
}

func TestGenerateReport_NilPool(t *testing.T) {
	r, err := NewService(nil, nil).GenerateReport(t.Context(), "u1", "week")
	_ = r; _ = err
}

func TestCareNudge(t *testing.T) {
	NewService(nil, nil).CareNudge(t.Context(), "u1", 2)
}

func TestGratitude(t *testing.T) {
	_, err := NewService(nil, nil).AddGratitude(t.Context(), "u1", "感谢今天的好天气")
	if err != nil { t.Log("nil pool gratitude:", err) }
}

func TestCheckin_InvalidScore(t *testing.T) {
	// score 0 should be clamped to 1
	_, err := NewService(nil, nil).Checkin(t.Context(), "u1", 0, "")
	if err != nil { t.Log("nil pool checkin:", err) }
}
