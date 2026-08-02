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
	userID := c.GetString("user_id")
	ctx := c.Request.Context()

	rows, err := h.svc.pool.Query(ctx,
		`SELECT id::text, COALESCE(conversation_id::text,''), audio_url, COALESCE(transcript,''), COALESCE(duration_ms,0), COALESCE(file_size,0)
		 FROM voice_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, userID,
	)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	var msgs []map[string]interface{}
	for rows.Next() {
		var id, convID, url, transcript string
		var duration, fileSize int
		rows.Scan(&id, &convID, &url, &transcript, &duration, &fileSize)
		msgs = append(msgs, map[string]interface{}{
			"id": id, "conversation_id": convID, "audio_url": url,
			"transcript": transcript, "duration_ms": duration, "file_size": fileSize,
		})
	}
	response.OK(c, msgs)
}
