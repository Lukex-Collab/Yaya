// Package bidcare — 双向守护理系统
// 产品最深层差异: 牙牙不是单方面服务你，她也需要你
// "你照顾牙牙，牙牙守护你" — 形成互赖的情感闭环
// 当用户知道"牙牙需要我"，忠诚度会大幅提升
package bidcare

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/care/yaya-status", h.GetYayaStatus)        // 牙牙的健康/心情/能量
	rg.POST("/care/tend", h.TendToYaya)                  // 照顾牙牙（抚摸/喂食/哄睡）
	rg.GET("/care/yaya-concerns", h.GetYayaConcerns)     // 牙牙担心你什么
	rg.POST("/care/reassure", h.ReassureYaya)            // 安抚牙牙的担心
	rg.GET("/care/mutual-report", h.GetMutualCareReport) // 双向关怀报告
}

func (h *Handler) GetYayaStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, _ := h.svc.GetYayaStatus(c.Request.Context(), userID)
	response.OK(c, status)
}
func (h *Handler) TendToYaya(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ Action string `json:"action" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "action required"); return }
	result, _ := h.svc.TendToYaya(c.Request.Context(), userID, req.Action)
	response.OK(c, result)
}
func (h *Handler) GetYayaConcerns(c *gin.Context) {
	userID := c.GetString("user_id")
	concerns, _ := h.svc.GetYayaConcerns(c.Request.Context(), userID)
	response.OK(c, concerns)
}
func (h *Handler) ReassureYaya(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ ConcernID string `json:"concern_id" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "concern_id required"); return }
	result, _ := h.svc.ReassureYaya(c.Request.Context(), userID, req.ConcernID)
	response.OK(c, result)
}
func (h *Handler) GetMutualCareReport(c *gin.Context) {
	userID := c.GetString("user_id")
	report, _ := h.svc.GetMutualCareReport(c.Request.Context(), userID)
	response.OK(c, report)
}
