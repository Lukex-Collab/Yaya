package dream

import "testing"

func TestGenerateDreamText_AllThemes(t *testing.T) {
	themes := []string{"adventure", "comfort", "magic", "healing", "reflection"}
	for _, theme := range themes {
		text := generateDreamText(theme, "", "")
		if text == "" { t.Errorf("theme %s: expected non-empty dream", theme) }
	}
}
func TestGenerateDreamText_InvalidTheme(t *testing.T) {
	text := generateDreamText("nonexistent", "", "")
	if text == "" { t.Error("expected fallback dream for invalid theme") }
}
