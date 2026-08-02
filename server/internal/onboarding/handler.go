package onboarding

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/onboarding/status", h.GetStatus)
	rg.POST("/onboarding/complete/:actionType", h.CompleteStep)
}

func (h *Handler) GetStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, err := h.svc.GetOnboardingStatus(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, status)
}
func (h *Handler) CompleteStep(c *gin.Context) {
	userID, actionType := c.GetString("user_id"), c.Param("actionType")
	h.svc.CompleteStep(c.Request.Context(), userID, actionType)
	response.OK(c, gin.H{"completed": true, "action": actionType})
}
