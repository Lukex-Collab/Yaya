package safety

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/safety/status", h.GetStatus)
	rg.GET("/safety/history", h.GetHistory)
}

func (h *Handler) GetStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, err := h.svc.GetStatus(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, status)
}

func (h *Handler) GetHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	logs, err := h.svc.GetHistory(c.Request.Context(), userID, 20)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, logs)
}
