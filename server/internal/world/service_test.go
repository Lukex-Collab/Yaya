package world

import (
	"context"
	"testing"
)

func TestSpeciesEmoji(t *testing.T) {
	species := []string{"云狐", "墨猫", "芽龙", "泡兔", "岩熊"}
	for _, s := range species {
		if SpeciesEmoji[s] == "" {
			t.Errorf("species %s has no emoji", s)
		}
	}
}

func TestGetZones(t *testing.T) {
	svc := NewService(nil)
	zones := svc.GetZones()

	if len(zones) != 5 {
		t.Errorf("expected 5 zones, got %d", len(zones))
	}

	ids := make(map[string]bool)
	for _, z := range zones {
		if ids[z.ID] {
			t.Errorf("duplicate zone ID: %s", z.ID)
		}
		ids[z.ID] = true
		if z.Name == "" {
			t.Errorf("zone %s has empty name", z.ID)
		}
		if z.Icon == "" {
			t.Errorf("zone %s has empty icon", z.ID)
		}
	}
}

func TestInvalidZone(t *testing.T) {
	svc := NewService(nil)

	_, err := svc.ExploreZone(context.Background(), "test-user", "invalid-zone")
	if err == nil {
		t.Error("expected error for invalid zone")
	}
}

func TestGetMyPet_NoDB(t *testing.T) {
	// GetMyPet with nil pool should still return defaults via fallback
	svc := NewService(nil)
	pet, err := svc.GetMyPet(context.Background(), "new-user")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pet.Name == "" {
		t.Error("expected default pet name")
	}
	if pet.Emoji == "" {
		t.Error("expected default pet emoji")
	}
}

func TestGetNearbyPets(t *testing.T) {
	svc := NewService(nil)
	pets := svc.GetNearbyPets()
	if len(pets) == 0 {
		t.Error("expected non-zero nearby pets")
	}
	for _, p := range pets {
		if p["name"] == "" || p["emoji"] == "" {
			t.Errorf("nearby pet missing fields: %v", p)
		}
	}
}

func TestFeedPet(t *testing.T) {
	svc := NewService(nil)
	// FeedPet doesn't need DB in current implementation
	result, err := svc.FeedPet(context.Background(), "test-user")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Message == "" {
		t.Error("expected non-empty message")
	}
}
