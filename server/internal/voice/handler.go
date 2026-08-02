package voice

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(pool *pgxpool.Pool, deepSeekKey, baseURL string) *Handler {
	return &Handler{svc: NewService(pool, deepSeekKey, baseURL)}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/voice/upload", h.UploadVoice)
	rg.GET("/voice/messages", h.ListVoiceMessages)
}

func (h *Handler) UploadVoice(c *gin.Context) {
	userID := c.GetString("user_id")
	convID := c.Query("conversation_id")

	file, header, err := c.Request.FormFile("audio")
	if err != nil {
		response.BadRequest(c, "audio file required")
		return
	}
	defer file.Close()

	url, err := h.svc.UploadFile(c.Request.Context(), file, header, userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	_ = convID

	response.OK(c, gin.H{"url": url, "msg": "语音消息已接收"})
}

func (h *Handler) ListVoiceMessages(c *gin.Context) {
	response.OK(c, []interface{}{}) // voice messages table may not exist yet
}
