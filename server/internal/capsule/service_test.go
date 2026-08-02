package capsule

import "testing"

func TestFilterMomentsByDays(t *testing.T) {
	// Empty input should return empty
	result := filterMomentsByDays(nil, 0, 7)
	if len(result) != 0 { t.Error("expected empty result for nil input") }
}

func TestMin(t *testing.T) {
	if min(3, 5) != 3 { t.Error("min broken") }
	if min(5, 3) != 3 { t.Error("min broken") }
}
