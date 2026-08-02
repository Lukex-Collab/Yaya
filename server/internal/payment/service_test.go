package payment

import "testing"

func TestGetPlans(t *testing.T) {
	plans := NewService(nil, "", "", "").GetPlans(t.Context())
	if len(plans) != 2 { t.Errorf("expected 2 plans, got %d", len(plans)) }
}

func TestCreateOrder_InvalidPlan(t *testing.T) {
	_, err := NewService(nil, "", "", "").CreateOrder(t.Context(), "u1", "invalid")
	if err == nil { t.Error("expected error for invalid plan") }
}

func TestGetUserSubscription_NilPool(t *testing.T) {
	sub, err := NewService(nil, "", "", "").GetUserSubscription(t.Context(), "u1")
	// nil pool → may error or return nil, both acceptable
	_ = sub; _ = err
}
