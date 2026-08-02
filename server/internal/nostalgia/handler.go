// Package nostalgia — 怀旧引擎 / "那年的今天"
// 牙牙不只是陪你聊天,她帮你记得人生的每一个闪光时刻
// "一年前的今天,你第一次对牙牙说'我好累'..."
// "三个月前的今天,你解锁了第一个成就..."
// 这种"被记住"的感觉是AI陪伴最深的情感锚点
package nostalgia

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/nostalgia/today", h.GetTodayMemory)
	rg.GET("/nostalgia/random", h.GetRandomMemory)
	rg.GET("/nostalgia/timeline", h.GetMemoryTimeline)
	rg.GET("/nostalgia/stats", h.GetMemoryStats)
}

func (h *Handler) GetTodayMemory(c *gin.Context) {
	userID := c.GetString("user_id")
	memory, _ := h.svc.GetTodayInHistory(c.Request.Context(), userID)
	response.OK(c, memory)
}

func (h *Handler) GetRandomMemory(c *gin.Context) {
	userID := c.GetString("user_id")
	memory, _ := h.svc.GetRandomHighlight(c.Request.Context(), userID)
	response.OK(c, memory)
}

func (h *Handler) GetMemoryTimeline(c *gin.Context) {
	userID := c.GetString("user_id")
	timeline, _ := h.svc.GetTimeline(c.Request.Context(), userID)
	response.OK(c, timeline)
}

func (h *Handler) GetMemoryStats(c *gin.Context) {
	userID := c.GetString("user_id")
	stats, _ := h.svc.GetStats(c.Request.Context(), userID)
	response.OK(c, stats)
}
