// Package dailytopic — 每日话题引擎
// 解决AI伴侣行业最大留存问题: "不知道聊什么"
// 牙牙每天自动准备3-5个个性化话题,主动发起聊天
// 哈佛研究: 被动等待用户开口的AI陪伴,7日留存<15%
package dailytopic

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool, deepseek *openai.Client) *Handler {
	return &Handler{svc: NewService(pool, deepseek)}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/dailytopic/today", h.GetTodayTopics)
	rg.POST("/dailytopic/respond", h.RespondToTopic)
	rg.GET("/dailytopic/history", h.GetTopicHistory)
	rg.GET("/dailytopic/suggest", h.SuggestTopic) // 随机新话题
}

func (h *Handler) GetTodayTopics(c *gin.Context) {
	userID := c.GetString("user_id")
	topics, _ := h.svc.GetTodayTopics(c.Request.Context(), userID)
	response.OK(c, topics)
}
func (h *Handler) RespondToTopic(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ TopicID string `json:"topic_id"`; Response string `json:"response"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "topic_id required"); return }
	result, _ := h.svc.RespondToTopic(c.Request.Context(), userID, req.TopicID, req.Response)
	response.OK(c, result)
}
func (h *Handler) GetTopicHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	history, _ := h.svc.GetTopicHistory(c.Request.Context(), userID)
	response.OK(c, history)
}
func (h *Handler) SuggestTopic(c *gin.Context) {
	topic := h.svc.SuggestRandomTopic()
	response.OK(c, topic)
}
