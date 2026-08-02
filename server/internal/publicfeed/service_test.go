package publicfeed

import "testing"

func TestNewService(t *testing.T) { if NewService(nil) == nil { t.Fatal("nil") } }
func TestGetPublicFeed_NoPool(t *testing.T) {
	f, _ := NewService(nil).GetPublicFeed(t.Context(), 1)
	if f == nil { t.Fatal("nil") }
}
func TestGenerateShareCard(t *testing.T) {
	c := NewService(nil).GenerateShareCard("j1")
	if c == "" { t.Error("expected card HTML") }
}
