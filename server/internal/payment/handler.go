package payment

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool, "", "", "")} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/payment/plans", h.GetPlans)
	rg.POST("/payment/order", h.CreateOrder)
	rg.GET("/payment/subscription", h.GetSubscription)
	rg.POST("/payment/subscription/cancel", h.CancelSubscription)
}

func (h *Handler) GetPlans(c *gin.Context) {
	response.OK(c, h.svc.GetPlans(c.Request.Context()))
}

type createOrderReq struct {
	PlanCode string `json:"plan_code" binding:"required"`
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req createOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "plan_code is required")
		return
	}
	userID := c.GetString("user_id")
	order, err := h.svc.CreateOrder(c.Request.Context(), userID, req.PlanCode)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, order)
}

func (h *Handler) GetSubscription(c *gin.Context) {
	userID := c.GetString("user_id")
	sub, err := h.svc.GetUserSubscription(c.Request.Context(), userID)
	if err != nil {
		response.NotFound(c, "no active subscription")
		return
	}
	response.OK(c, sub)
}

func (h *Handler) CancelSubscription(c *gin.Context) {
	userID := c.GetString("user_id")
	if err := h.svc.CancelSubscription(c.Request.Context(), userID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"cancelled": true})
}
