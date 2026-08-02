package safetyfilter

import "testing"

func TestContains(t *testing.T) {
	f := New()
	f.AddWords([]string{"敏感词A", "敏感词B", "测试"})

	tests := []struct {
		input    string
		expected bool
	}{
		{"这是正常文本", false},
		{"包含敏感词A的文本", true},
		{"包含敏感词B在这里", true},
		{"这是测试内容", true},
		{"正常的中文文本没有关键词", false},
	}

	for _, tt := range tests {
		if got := f.Contains(tt.input); got != tt.expected {
			t.Errorf("Contains(%q) = %v, want %v", tt.input, got, tt.expected)
		}
	}
}

func TestReplace(t *testing.T) {
	f := New()
	f.AddWords([]string{"敏感词", "测试"})

	got := f.Replace("这是包含敏感词的测试文本")
	want := "这是包含***的**文本"

	if got != want {
		t.Errorf("Replace() = %q, want %q", got, want)
	}
}

func TestValidateContent(t *testing.T) {
	f := New()
	f.AddWords([]string{"违规"})

	tests := []struct {
		input   string
		pass    bool
		reason  string
	}{
		{"", false, "消息不能为空"},
		{"正常消息", true, ""},
		{"包含违规内容的消息", false, "消息包含违规内容"},
	}

	for _, tt := range tests {
		pass, reason := f.ValidateContent(tt.input)
		if pass != tt.pass {
			t.Errorf("ValidateContent(%q) pass = %v, want %v", tt.input, pass, tt.pass)
		}
		if reason != tt.reason {
			t.Errorf("ValidateContent(%q) reason = %q, want %q", tt.input, reason, tt.reason)
		}
	}
}

func BenchmarkContains(b *testing.B) {
	f := New()
	f.AddWords([]string{"测试", "敏感词", "示例", "内容A", "内容B", "违规言论"})
	text := "这是一段很长的测试文本，包含了一些敏感词和示例内容，需要检测"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		f.Contains(text)
	}
}
