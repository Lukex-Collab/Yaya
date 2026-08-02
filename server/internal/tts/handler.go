// Package tts — 语音合成服务
// 让牙牙拥有专属声音，从文字变成"听得见的朋友"
// 支持多Provider: ElevenLabs / 火山引擎(豆包) / 阿里云 / 微信同声传译
//
// 产品意义: 声音是最深层的情感触媒 — 听到牙牙说"你在吗～"比看到文字震撼10倍
package tts

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool, apiKey string) *Handler { return &Handler{svc: NewService(pool, apiKey)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/tts/synthesize", h.Synthesize)
	rg.GET("/tts/voices", h.ListVoices)
	rg.POST("/tts/voice/select", h.SelectVoice)     // 选择/切换音色
	rg.GET("/tts/history", h.GetHistory)             // 合成历史
	rg.POST("/tts/preview", h.PreviewVoice)          // 试听
}

func (h *Handler) Synthesize(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ Text string `json:"text" binding:"required"`; VoiceID string `json:"voice_id"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "text required"); return }
	result, err := h.svc.Synthesize(c.Request.Context(), userID, req.Text, req.VoiceID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) ListVoices(c *gin.Context) {
	voices := h.svc.ListVoices()
	response.OK(c, voices)
}

func (h *Handler) SelectVoice(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ VoiceID string `json:"voice_id" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "voice_id required"); return }
	h.svc.SelectVoice(c.Request.Context(), userID, req.VoiceID)
	response.OK(c, gin.H{"selected": req.VoiceID})
}

func (h *Handler) GetHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	history, _ := h.svc.GetHistory(c.Request.Context(), userID)
	response.OK(c, history)
}

func (h *Handler) PreviewVoice(c *gin.Context) {
	var req struct{ VoiceID string `json:"voice_id" binding:"required"`; Text string `json:"text"`
	}
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "voice_id required"); return }
	if req.Text == "" { req.Text = "你好，我是牙牙，你的专属守护玩偶～" }
	url, _ := h.svc.Preview(c.Request.Context(), req.VoiceID, req.Text)
	response.OK(c, gin.H{"url": url})
}
