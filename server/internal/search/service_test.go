package search

import "testing"

func TestNewService(t *testing.T) {
	if NewService(nil) == nil { t.Fatal("nil") }
}
func TestSearchAll_NilPool(t *testing.T) {
	r, err := NewService(nil).SearchAll(t.Context(), "u1", "test")
	if err != nil || r == nil { t.Fatal("expected non-nil") }
}
func TestGetSuggestions_NilPool(t *testing.T) {
	s, _ := NewService(nil).GetSuggestions(t.Context(), "u1")
	if s != nil && len(s) > 0 { t.Log("suggestions", s) }
}
