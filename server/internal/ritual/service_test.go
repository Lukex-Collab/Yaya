package ritual

import "testing"

func TestGoodMorning_Fallback(t *testing.T) {
	// Without DeepSeek client, should return fallback
	svc := NewService(nil, nil)
	greeting, err := svc.GoodMorning(t.Context(), "user1", "小美", "牙牙")
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if greeting == "" { t.Error("expected fallback greeting") }
}

func TestGoodNight_Fallback(t *testing.T) {
	svc := NewService(nil, nil)
	greeting, err := svc.GoodNight(t.Context(), "user1", "小美", "牙牙")
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if greeting == "" { t.Error("expected fallback greeting") }
}

func TestBedtimeStory_Fallback(t *testing.T) {
	svc := NewService(nil, nil)
	story, err := svc.BedtimeStory(t.Context(), "牙牙")
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if story == "" { t.Error("expected fallback story") }
}

func TestCalendarSeedData(t *testing.T) {
	events := GetSeedEvents()
	if len(events) < 20 {
		t.Errorf("expected at least 20 seed events, got %d", len(events))
	}
	for _, e := range events {
		if e.Summary == "" { t.Errorf("event %s has empty summary", e.DateMMDD) }
		if e.DateMMDD == "" || len(e.DateMMDD) != 5 { t.Errorf("invalid date format: %s", e.DateMMDD) }
	}
}
