package dailytopic

import "testing"

func TestNewService(t *testing.T) { if NewService(nil, nil) == nil { t.Fatal("nil") } }
func TestAllTopics_Coverage(t *testing.T) {
	topics := NewService(nil, nil).allTopics()
	if len(topics) < 10 { t.Errorf("expected >=10 topics, got %d", len(topics)) }
	cats := map[string]bool{}
	for _, tp := range topics {
		if tp.Question == "" || tp.Category == "" { t.Error("incomplete topic") }
		cats[tp.Category] = true
	}
	if len(cats) < 4 { t.Errorf("expected >=4 categories, got %d", len(cats)) }
}
func TestFallbackTopics(t *testing.T) {
	ft := NewService(nil, nil).fallbackTopics()
	if len(ft) == 0 { t.Error("expected fallback topics") }
}
func TestSuggestRandom(t *testing.T) {
	topic := NewService(nil, nil).SuggestRandomTopic()
	if topic.Question == "" { t.Error("expected question") }
}
