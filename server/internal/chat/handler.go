package chat

import (
	"encoding/json"
	"fmt"
	"net/http"

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
	rg.POST("/chat/send", h.SendMessage)
	rg.GET("/chat/history", h.GetHistory)
	rg.DELETE("/chat/history/:id", h.DeleteConversation)
	rg.GET("/chat/daily-limit", h.DailyLimit)
}
func (h *Handler) DailyLimit(c *gin.Context) {
	c.JSON(200, gin.H{"code":0,"msg":"ok","data":gin.H{"used":0,"limit":50,"remaining":50}})
}

type sendRequest struct {
	Content        string `json:"content" binding:"required"`
	ConversationID string `json:"conversation_id"`
}

func (h *Handler) SendMessage(c *gin.Context) {
	var req sendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "content is required")
		return
	}

	userID := c.GetString("user_id")

	// SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.WriteHeader(http.StatusOK)

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		response.InternalError(c, "streaming not supported")
		return
	}

	ch, err := h.svc.SendMessage(c.Request.Context(), userID, req.ConversationID, req.Content)
	if err != nil {
		data, _ := json.Marshal(StreamEvent{Done: true, Error: err.Error()})
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
		return
	}

	convID := ""
	for event := range ch {
		if event.ConvID != "" {
			convID = event.ConvID
		}
		data, _ := json.Marshal(event)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
		if event.Done {
			break
		}
	}
	_ = convID
}

func (h *Handler) GetHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	page := 1
	pageSize := 20

	convs, err := h.svc.GetHistory(c.Request.Context(), userID, page, pageSize)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, convs)
}

func (h *Handler) DeleteConversation(c *gin.Context) {
	userID := c.GetString("user_id")
	convID := c.Param("id")

	if err := h.svc.DeleteConversation(c.Request.Context(), userID, convID); err != nil {
		if err.Error() == "unauthorized" || err.Error() == "conversation not found" {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true})
}
