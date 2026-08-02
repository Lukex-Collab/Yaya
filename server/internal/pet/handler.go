package pet

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	engine *AutonomousEngine
}

func NewHandler(engine *AutonomousEngine) *Handler {
	return &Handler{engine: engine}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/pet/activity", h.GetTodayActivity)
}

func (h *Handler) GetTodayActivity(c *gin.Context) {
	userID := c.GetString("user_id")
	logs, err := h.engine.GetTodayActivity(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, logs)
}
