package achievement

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
	rg.GET("/achievement/list", h.GetAll)
}

func (h *Handler) GetAll(c *gin.Context) {
	userID := c.GetString("user_id")
	achievements, err := h.svc.GetAll(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, achievements)
}
