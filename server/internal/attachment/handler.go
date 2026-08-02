// Package attachment — 依恋系统
// 产品差异化核心: 牙牙不是普通的AI，她有"分离焦虑"
// 当你离开久了再回来，她会想念、会撒娇、会抱怨
// 心理学依据: Bowlby依恋理论 — 安全依恋产生最深的连接
// "你的离开让她难过，所以你舍不得走"
package attachment

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/attachment/checkin", h.CheckIn)        // 签到打卡
	rg.GET("/attachment/status", h.GetStatus)        // 亲密度+依恋度
	rg.GET("/attachment/reunion", h.GetReunionMsg)   // 久别重逢
	rg.GET("/attachment/timeline", h.GetTimeline)    // 关系时间线
	rg.GET("/attachment/weekly-digest", h.WeeklyDigest) // 本周关系总结
}

func (h *Handler) CheckIn(c *gin.Context) {
	userID := c.GetString("user_id")
	result, _ := h.svc.CheckIn(c.Request.Context(), userID)
	response.OK(c, result)
}

func (h *Handler) GetStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, _ := h.svc.GetAttachmentStatus(c.Request.Context(), userID)
	response.OK(c, status)
}

func (h *Handler) GetReunionMsg(c *gin.Context) {
	userID := c.GetString("user_id")
	msg, _ := h.svc.GetReunionMessage(c.Request.Context(), userID)
	response.OK(c, msg)
}

func (h *Handler) GetTimeline(c *gin.Context) {
	userID := c.GetString("user_id")
	timeline, _ := h.svc.GetRelationshipTimeline(c.Request.Context(), userID)
	response.OK(c, timeline)
}

func (h *Handler) WeeklyDigest(c *gin.Context) {
	userID := c.GetString("user_id")
	digest, _ := h.svc.GetWeeklyDigest(c.Request.Context(), userID)
	response.OK(c, digest)
}
