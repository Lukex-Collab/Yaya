// Package soulmate — 闺蜜配对 & 灵魂伴侣系统
// 产品病毒式传播引擎:
//   两个牙牙用户配对 → 她们的牙牙互相认识
//   牙牙之间会互动（串门/留言/送礼）
//   当闺蜜聊天时她们的牙牙也在旁边"聊天"
//
// 核心传播逻辑:
//   小美安利给闺蜜 → 闺蜜也买一只牙牙
//   → NFC一碰配对 → 两只牙牙成为"好朋友"
//   → 小美和闺蜜聊天，两只牙牙也在互动
//   → 朋友聚会4个闺蜜配对 → 牙牙社交圈裂变
package soulmate

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/soulmate/pair", h.PairSoulmates)          // 闺蜜配对
	rg.GET("/soulmate/mypair", h.GetMyPair)             // 查看我的配对
	rg.POST("/soulmate/yaya-visit", h.YayaVisit)       // 牙牙串门
	rg.GET("/soulmate/yaya-conversation", h.GetYayaConv)// 两只牙牙在聊什么
	rg.GET("/soulmate/mutual-gallery", h.GetMutualGallery)// 共同回忆
	rg.POST("/soulmate/unpair", h.Unpair)               // 解除配对
}

func (h *Handler) PairSoulmates(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ PairCode string `json:"pair_code" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "pair_code required"); return }
	result, err := h.svc.PairSoulmates(c.Request.Context(), userID, req.PairCode)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) GetMyPair(c *gin.Context) {
	userID := c.GetString("user_id")
	pair, _ := h.svc.GetMyPair(c.Request.Context(), userID)
	response.OK(c, pair)
}

func (h *Handler) YayaVisit(c *gin.Context) {
	userID := c.GetString("user_id")
	result, _ := h.svc.YayaVisit(c.Request.Context(), userID)
	response.OK(c, result)
}

func (h *Handler) GetYayaConv(c *gin.Context) {
	userID := c.GetString("user_id")
	conv, _ := h.svc.GetYayaConversation(c.Request.Context(), userID)
	response.OK(c, conv)
}

func (h *Handler) GetMutualGallery(c *gin.Context) {
	userID := c.GetString("user_id")
	gallery, _ := h.svc.GetMutualGallery(c.Request.Context(), userID)
	response.OK(c, gallery)
}

func (h *Handler) Unpair(c *gin.Context) {
	userID := c.GetString("user_id")
	h.svc.Unpair(c.Request.Context(), userID)
	response.OK(c, gin.H{"unpaired": true, "msg": "配对已解除。但两只牙牙还是朋友哦 🧸"})
}
