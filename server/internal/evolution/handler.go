package evolution

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/evolution/stage", h.GetStage)
	rg.GET("/evolution/history", h.GetHistory)
}

func (h *Handler) GetStage(c *gin.Context) {
	stage, err := h.svc.GetCurrentStage(c.Request.Context(), c.GetString("user_id"))
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, stage)
}

func (h *Handler) GetHistory(c *gin.Context) {
	response.OK(c, []interface{}{}) // TODO: return evolution history
}
