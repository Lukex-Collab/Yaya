// Package emotion — 情绪分析服务
// 从日记和对话中提取情绪趋势、生成洞察报告
package emotion

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/emotion/trend", h.GetTrend)
	rg.GET("/emotion/report", h.GetReport)
	rg.GET("/emotion/insights", h.GetInsights)
	rg.POST("/emotion/rescue", h.EmotionRescue)
}

func (h *Handler) GetTrend(c *gin.Context) {
	userID := c.GetString("user_id")
	period := c.DefaultQuery("period", "week")
	trend, err := h.svc.GetTrend(c.Request.Context(), userID, period)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, trend)
}

func (h *Handler) GetReport(c *gin.Context) {
	userID := c.GetString("user_id")
	report, err := h.svc.GetMonthlyReport(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, report)
}

func (h *Handler) GetInsights(c *gin.Context) {
	userID := c.GetString("user_id")
	insights, err := h.svc.GetInsights(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, insights)
}

func (h *Handler) EmotionRescue(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ Action string `json:"action" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "action required")
		return
	}
	result, err := h.svc.EmotionRescue(c.Request.Context(), userID, req.Action)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, result)
}
