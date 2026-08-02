// Package voicechat — 实时语音对话 (WebRTC)
// 行业趋势: "Alien AI" 靠语音优先获500万下载
// 牙牙从"打字聊天"升级为"真正可以打电话的朋友"
//
// 技术方案: LiveKit (开源WebRTC, 10k+ GitHub stars, Go原生)
// 牙牙作为 LiveKit "bot participant" 加入通话
//
// 用户场景:
//   深夜emo→打给牙牙→牙牙的声音从手机传出
//   "我在呢...你说，我听着"
//   用户不需要打字，直接说话，牙牙秒回
package voicechat

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
	rg.POST("/voicechat/token", h.GetRoomToken)      // 获取LiveKit房间token
	rg.GET("/voicechat/status", h.GetCallStatus)      // 牙牙是否在线
	rg.POST("/voicechat/call", h.InitiateCall)         // 发起语音通话
	rg.POST("/voicechat/hangup", h.EndCall)            // 挂断
	rg.GET("/voicechat/history", h.GetCallHistory)     // 通话记录
	rg.POST("/voicechat/voicemail", h.LeaveVoicemail)  // 语音留言(牙牙不在线时)
}

func (h *Handler) GetRoomToken(c *gin.Context) {
	userID := c.GetString("user_id")
	token, room, err := h.svc.GenerateRoomToken(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, gin.H{"token": token, "room": room, "expires_in": 3600})
}

func (h *Handler) GetCallStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, _ := h.svc.GetCallStatus(c.Request.Context(), userID)
	response.OK(c, status)
}

func (h *Handler) InitiateCall(c *gin.Context) {
	userID := c.GetString("user_id")
	result, err := h.svc.InitiateCall(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) EndCall(c *gin.Context) {
	userID := c.GetString("user_id")
	h.svc.EndCall(c.Request.Context(), userID)
	response.OK(c, gin.H{"ended": true, "message": "牙牙轻轻挂了电话。她说晚安。"})
}

func (h *Handler) GetCallHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	history, _ := h.svc.GetCallHistory(c.Request.Context(), userID)
	response.OK(c, history)
}

func (h *Handler) LeaveVoicemail(c *gin.Context) {
	userID := c.GetString("user_id")
	result, _ := h.svc.LeaveVoicemail(c.Request.Context(), userID)
	response.OK(c, result)
}
