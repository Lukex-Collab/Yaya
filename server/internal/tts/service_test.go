package tts

import "testing"

func TestNewService(t *testing.T) { if NewService(nil, "") == nil { t.Fatal("nil") } }

func TestListVoices(t *testing.T) {
	voices := NewService(nil, "").ListVoices()
	if len(voices) != 5 { t.Errorf("expected 5 voices, got %d", len(voices)) }
	for _, v := range voices {
		if v.ID == "" || v.Name == "" { t.Errorf("voice missing fields: %+v", v) }
	}
}
func TestSelectVoice(t *testing.T) {
	_ = NewService(nil, "").SelectVoice(t.Context(), "u1", "yaya_soft")
}
func TestGetHistory_NilPool(t *testing.T) {
	h, _ := NewService(nil, "").GetHistory(t.Context(), "u1")
	if h != nil && len(h) > 0 { t.Log("history items:", len(h)) }
}
