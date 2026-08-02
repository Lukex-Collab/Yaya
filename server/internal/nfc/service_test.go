package nfc

import "testing"

func TestIsValidNTAG215UID(t *testing.T) {
	if !isValidNTAG215UID("04A1B2C3D4E5F6") { t.Error("expected valid 14-char hex UID") }
	if isValidNTAG215UID("short") { t.Error("expected invalid short UID") }
	if isValidNTAG215UID("04A1B2C3D4E5ZZ") { t.Error("expected invalid hex ZZ") }
}

func TestIsValidSpecies(t *testing.T) {
	for _, s := range []string{"云狐", "墨猫", "芽龙", "泡兔", "岩熊"} {
		if !isValidSpecies(s) { t.Errorf("expected %s to be valid", s) }
	}
	if isValidSpecies("恐龙") { t.Error("expected invalid species") }
}

func TestSpeciesEmoji(t *testing.T) {
	for _, s := range []string{"云狐", "墨猫", "芽龙", "泡兔", "岩熊"} {
		if speciesEmoji(s) == "" { t.Errorf("expected emoji for %s", s) }
	}
}
