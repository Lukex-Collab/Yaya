package push

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(pool *pgxpool.Pool, deepseek *openai.Client) *Handler {
	return &Handler{svc: NewService(pool, deepseek)}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/push/messages", h.GetMessages)
	rg.POST("/push/messages/:id/read", h.MarkRead)
	rg.GET("/push/unread-count", h.UnreadCount)
}

func (h *Handler) GetMessages(c *gin.Context) {
	userID := c.GetString("user_id")
	unreadOnly := c.Query("unread") == "true"
	msgs, err := h.svc.GetUserMessages(c.Request.Context(), userID, unreadOnly, 50)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, msgs)
}

func (h *Handler) MarkRead(c *gin.Context) {
	userID := c.GetString("user_id")
	msgID := c.Param("id")
	if err := h.svc.MarkAsRead(c.Request.Context(), userID, msgID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"read": true})
}

func (h *Handler) UnreadCount(c *gin.Context) {
	userID := c.GetString("user_id")
	count, err := h.svc.UnreadCount(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"count": count})
}
