// Package share — 分享卡片生成服务
// 生成可分享的精美图片卡片（日记/成就/情绪报告）
package share

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler() *Handler { return &Handler{svc: NewService()} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/share/journal/:id", h.ShareJournal)
	rg.POST("/share/achievement", h.ShareAchievement)
	rg.POST("/share/emotion-report", h.ShareEmotionReport)
	rg.GET("/share/cards", h.GetMyCards)
}

func (h *Handler) ShareJournal(c *gin.Context) {
	userID := c.GetString("user_id")
	journalID := c.Param("id")
	card, err := h.svc.GenerateJournalCard(c.Request.Context(), userID, journalID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, card)
}

func (h *Handler) ShareAchievement(c *gin.Context) {
	var req struct{ Code string `json:"code" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "code required"); return }
	userID := c.GetString("user_id")
	card, err := h.svc.GenerateAchievementCard(c.Request.Context(), userID, req.Code)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, card)
}

func (h *Handler) ShareEmotionReport(c *gin.Context) {
	userID := c.GetString("user_id")
	card, err := h.svc.GenerateEmotionReportCard(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, card)
}

func (h *Handler) GetMyCards(c *gin.Context) {
	userID := c.GetString("user_id")
	cards, _ := h.svc.GetMyCards(c.Request.Context(), userID)
	response.OK(c, cards)
}
