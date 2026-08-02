package emotion

import (
	"testing"
)

func TestGenerateInsights_Empty(t *testing.T) {
	counts := map[string]int{}
	insights := generateInsights(counts, nil)
	if len(insights) == 0 {
		t.Error("expected at least fallback message")
	}
	if insights[0] == "" {
		t.Error("expected non-empty insight")
	}
}

func TestGenerateInsights_HappyMonth(t *testing.T) {
	counts := map[string]int{"happy": 20, "excited": 5, "calm": 5}
	points := make([]TrendPoint, 30)
	for i := range points { points[i] = TrendPoint{Emotion: "happy"} }
	insights := generateInsights(counts, points)
	if len(insights) == 0 {
		t.Error("expected insights for happy month")
	}
}

func TestEmotionRescue_AllActions(t *testing.T) {
	svc := NewService(nil)
	actions := []string{"hug", "breathe", "whitenoise", "vent", "gratitude", "unknown"}

	for _, action := range actions {
		result, err := svc.EmotionRescue(t.Context(), "test-user", action)
		if err != nil {
			t.Errorf("action %s: unexpected error %v", action, err)
		}
		if result == nil {
			t.Errorf("action %s: expected non-nil result", action)
		}
	}
}

func TestEmotionRescue_DefaultFallback(t *testing.T) {
	svc := NewService(nil)
	result, _ := svc.EmotionRescue(t.Context(), "test-user", "nonexistent")
	action, _ := result["action"].(RescueAction)
	if action.Type != "hug" {
		t.Error("expected hug as default fallback")
	}
}
