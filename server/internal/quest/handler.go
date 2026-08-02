package quest

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/quest/today", h.GetToday)
	rg.POST("/quest/claim/:id", h.Claim)
}

func (h *Handler) GetToday(c *gin.Context) {
	quests, err := h.svc.GetTodayQuests(c.Request.Context(), c.GetString("user_id"))
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, quests)
}

func (h *Handler) Claim(c *gin.Context) {
	reward, err := h.svc.ClaimReward(c.Request.Context(), c.GetString("user_id"), c.Param("id"))
	if err != nil { response.BadRequest(c, err.Error()); return }
	response.OK(c, gin.H{"reward_gems": reward, "msg": "奖励已发放"})
}
