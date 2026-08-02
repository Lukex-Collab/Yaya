package chat

import (
	"strings"
	"testing"
)

func TestGeneratePersonality(t *testing.T) {
	p := GeneratePersonality(42)
	if p.Species == "" {
		t.Error("species should not be empty")
	}
	if p.SpeechStyle == "" {
		t.Error("speech style should not be empty")
	}
	if len(p.Fears) == 0 {
		t.Error("should have fears")
	}
	if len(p.Loves) == 0 {
		t.Error("should have loves")
	}
}

func TestGeneratePersonalityDeterministic(t *testing.T) {
	p1 := GeneratePersonality(100)
	p2 := GeneratePersonality(100)
	if p1.Species != p2.Species || p1.Courage != p2.Courage {
		t.Error("same seed should produce same personality")
	}
}

func TestBuildSystemPrompt(t *testing.T) {
	p := GeneratePersonality(1)
	prompt := BuildSystemPrompt("小满", "团子", p, []string{"小满喜欢喝咖啡"}, "晚上9点", "下雨")

	if !strings.Contains(prompt, "团子") {
		t.Error("prompt should contain pet name")
	}
	if !strings.Contains(prompt, "小满") {
		t.Error("prompt should contain user name")
	}
	if !strings.Contains(prompt, "喝咖啡") {
		t.Error("prompt should contain memories")
	}
	if !strings.Contains(prompt, "晚上9点") {
		t.Error("prompt should contain time")
	}
	if !strings.Contains(prompt, "下雨") {
		t.Error("prompt should contain weather")
	}
	if !strings.Contains(prompt, "你不是AI助手") {
		t.Error("prompt should state not an AI assistant")
	}
}

func TestBuildSystemPromptEmptyMemories(t *testing.T) {
	p := GeneratePersonality(99)
	prompt := BuildSystemPrompt("主人", "牙牙", p, nil, "", "")
	// "你记得" 不出现在 memories 区域（那段用大标题标注）
	if strings.Contains(prompt, "【你记得关于主人的事】") {
		t.Error("should not have memories section when none exist")
	}
}
