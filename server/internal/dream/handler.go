// Package dream — 梦境编织者
// 产品差异化: 每天睡前，牙牙为用户编一个"今晚的梦境"
// 梦境基于用户当天的日记/情绪/聊天内容来个性化生成
// 第二天早上，牙牙问"昨晚梦到了吗？"——创造共同体验
package dream

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool, deepseek *openai.Client) *Handler { return &Handler{svc: NewService(pool, deepseek)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/dream/tonight", h.GetTonightDream)
	rg.GET("/dream/history", h.GetDreamHistory)
	rg.POST("/dream/feedback", h.DreamFeedback)
	rg.GET("/dream/last-night", h.GetLastNightDream)
}

func (h *Handler) GetTonightDream(c *gin.Context) {
	userID := c.GetString("user_id")
	dream, _ := h.svc.GenerateDream(c.Request.Context(), userID)
	response.OK(c, dream)
}
func (h *Handler) GetDreamHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	dreams, _ := h.svc.GetDreamHistory(c.Request.Context(), userID)
	response.OK(c, dreams)
}
func (h *Handler) DreamFeedback(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ DreamID string `json:"dream_id"`; Reaction string `json:"reaction"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "dream_id and reaction required"); return }
	h.svc.SaveFeedback(c.Request.Context(), userID, req.DreamID, req.Reaction)
	response.OK(c, gin.H{"saved": true})
}
func (h *Handler) GetLastNightDream(c *gin.Context) {
	userID := c.GetString("user_id")
	dream, _ := h.svc.GetLastNightDream(c.Request.Context(), userID)
	response.OK(c, dream)
}
