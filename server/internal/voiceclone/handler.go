package voiceclone

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool, ttsURL string) *Handler { return &Handler{svc: NewService(pool, ttsURL)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/voiceclone/sample", h.UploadSample)
	rg.GET("/voiceclone/voices", h.GetMyVoices)
	rg.POST("/voiceclone/synthesize", h.Synthesize)
	rg.GET("/voiceclone/status", h.CheckStatus)
}

func (h *Handler) UploadSample(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ AudioBase64 string `json:"audio_base64" binding:"required"`; DurationSec int `json:"duration_sec"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "audio_base64 required"); return }
	sample, err := h.svc.UploadSample(c.Request.Context(), userID, req.AudioBase64, req.DurationSec)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, sample)
}

func (h *Handler) GetMyVoices(c *gin.Context) {
	userID := c.GetString("user_id")
	voices, _ := h.svc.GetMyVoices(c.Request.Context(), userID)
	response.OK(c, voices)
}

func (h *Handler) Synthesize(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ Text string `json:"text" binding:"required"`; VoiceID string `json:"voice_id"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "text required"); return }
	result, err := h.svc.Synthesize(c.Request.Context(), userID, req.Text, req.VoiceID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) CheckStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, _ := h.svc.CheckCloneStatus(c.Request.Context(), userID)
	response.OK(c, status)
}
