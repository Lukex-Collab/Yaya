package soulmate

import "testing"

func TestRandomBond_ReturnsValidBond(t *testing.T) {
	bonds := map[string]bool{"best_friends": true, "sisters": true, "partners_in_crime": true, "soul_sisters": true}
	for i := 0; i < 20; i++ {
		b := randomBond()
		if !bonds[b] { t.Errorf("invalid bond: %s", b) }
	}
}

func TestSpeciesEmoji(t *testing.T) {
	for _, s := range []string{"云狐", "墨猫", "芽龙", "泡兔", "岩熊"} {
		if speciesEmoji(s) == "" { t.Errorf("expected emoji for %s", s) }
	}
}

func TestServiceInit(t *testing.T) {
	svc := NewService(nil)
	if svc == nil { t.Fatal("expected non-nil service") }
}
