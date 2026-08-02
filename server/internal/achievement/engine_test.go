package achievement

import (
	"testing"
)

func TestDefaultAchievements(t *testing.T) {
	t.Run("complete_coverage", func(t *testing.T) {
		categories := make(map[string]int)
		for _, a := range DefaultAchievements {
			categories[a.Category]++
			if a.Name == "" {
				t.Errorf("achievement %s has empty name", a.Code)
			}
			if a.Tier < 1 || a.Tier > 3 {
				t.Errorf("achievement %s has invalid tier %d", a.Code, a.Tier)
			}
		}

		// 应覆盖所有类别
		for _, cat := range []string{"milestone", "special", "social", "emotion"} {
			if categories[cat] == 0 {
				t.Errorf("no achievements in category: %s", cat)
			}
		}
	})

	t.Run("unique_codes", func(t *testing.T) {
		codes := make(map[string]bool)
		for _, a := range DefaultAchievements {
			if codes[a.Code] {
				t.Errorf("duplicate achievement code: %s", a.Code)
			}
			codes[a.Code] = true
		}
	})

	t.Run("count", func(t *testing.T) {
		if len(DefaultAchievements) != 11 {
			t.Errorf("expected 11 achievements, got %d", len(DefaultAchievements))
		}
	})
}

func TestService_SeedAchievements(t *testing.T) {
	// 种子数据本身不依赖数据库，只验证数据结构
	for _, a := range DefaultAchievements {
		if a.Code == "" {
			t.Error("achievement code cannot be empty")
		}
		if a.Target < 0 {
			t.Errorf("achievement %s has negative target", a.Code)
		}
	}
}

func TestCollectorLogic(t *testing.T) {
	// 收藏家成就 — target=0 意味着需要所有其他成就解锁后自动触发
	collector := DefaultAchievements[len(DefaultAchievements)-1]
	if collector.Code != "collector" {
		t.Error("last achievement should be collector")
	}
	if collector.Target != 0 {
		t.Error("collector should have target=0 (auto-unlock when all others done)")
	}
}

func TestMilestoneDays(t *testing.T) {
	// 验证天数里程碑的 target 值
	dayMilestones := map[string]int{
		"first_chat":   1,
		"seven_days":   7,
		"thirty_days":  30,
		"hundred_days": 100,
	}

	for _, a := range DefaultAchievements {
		if expected, exists := dayMilestones[a.Code]; exists {
			if a.Target != expected {
				t.Errorf("%s target should be %d, got %d", a.Code, expected, a.Target)
			}
		}
	}
}
