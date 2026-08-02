package ritual

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc  *Service
	pool *pgxpool.Pool
}

func NewHandler(svc *Service, pool *pgxpool.Pool) *Handler {
	return &Handler{svc: svc, pool: pool}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// 仪式
	rg.POST("/ritual/good-morning", h.GoodMorning)
	rg.POST("/ritual/good-night", h.GoodNight)
	rg.GET("/ritual/bedtime-story", h.BedtimeStory)
	// 推送设置
	rg.GET("/ritual/schedule", h.GetSchedule)
	rg.PUT("/ritual/schedule", h.UpdateSchedule)
	// 女子日历
	rg.GET("/ritual/calendar/today", h.TodayCalendar)
	rg.GET("/ritual/calendar/week", h.WeekCalendar)
}

// ═══ 帮助函数 ═══

func (h *Handler) getNames(ctx context.Context, userID string) (string, string) {
	var nickname, yayaName string
	h.pool.QueryRow(ctx,
		`SELECT nickname, yaya_nickname FROM users WHERE id = $1`, userID,
	).Scan(&nickname, &yayaName)
	if nickname == "" { nickname = "主人" }
	if yayaName == "" { yayaName = "牙牙" }
	return nickname, yayaName
}

// ═══ 仪式 ═══

func (h *Handler) GoodMorning(c *gin.Context) {
	userID := c.GetString("user_id")
	nickname, yayaName := h.getNames(c.Request.Context(), userID)
	greeting, err := h.svc.GoodMorning(c.Request.Context(), userID, nickname, yayaName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"greeting": greeting})
}

func (h *Handler) GoodNight(c *gin.Context) {
	userID := c.GetString("user_id")
	nickname, yayaName := h.getNames(c.Request.Context(), userID)
	greeting, err := h.svc.GoodNight(c.Request.Context(), userID, nickname, yayaName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"greeting": greeting})
}

func (h *Handler) BedtimeStory(c *gin.Context) {
	userID := c.GetString("user_id")
	_, yayaName := h.getNames(c.Request.Context(), userID)
	story, err := h.svc.BedtimeStory(c.Request.Context(), yayaName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"story": story})
}

// ═══ 推送设置 ═══

func (h *Handler) GetSchedule(c *gin.Context) {
	userID := c.GetString("user_id")
	ctx := c.Request.Context()

	var morningTime, nightTime string
	var morningEnabled, nightEnabled bool
	var quietStart, quietEnd, dailyCount int

	err := h.pool.QueryRow(ctx,
		`SELECT COALESCE(greeting_time::text,'08:00'), COALESCE(bedtime_time::text,'22:30'),
		 COALESCE(morning_enabled,true), COALESCE(night_enabled,true),
		 COALESCE(quiet_start_hour,22), COALESCE(quiet_end_hour,7), COALESCE(daily_count,0)
		 FROM user_settings us LEFT JOIN push_settings ps ON us.user_id=ps.user_id WHERE us.user_id=$1`, userID,
	).Scan(&morningTime, &nightTime, &morningEnabled, &nightEnabled, &quietStart, &quietEnd, &dailyCount)

	if err != nil {
		// defaults
		morningTime, nightTime = "08:00", "22:30"
		morningEnabled, nightEnabled = true, true
		quietStart, quietEnd = 22, 7
	}

	response.OK(c, gin.H{
		"morning_time": morningTime, "night_time": nightTime,
		"morning_enabled": morningEnabled, "night_enabled": nightEnabled,
		"quiet_start": quietStart, "quiet_end": quietEnd,
		"today_pushed": dailyCount,
	})
}

func (h *Handler) UpdateSchedule(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		MorningTime    *string `json:"morning_time"`
		NightTime      *string `json:"night_time"`
		MorningEnabled *bool   `json:"morning_enabled"`
		NightEnabled   *bool   `json:"night_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request")
		return
	}
	ctx := c.Request.Context()

	if req.MorningTime != nil {
		h.pool.Exec(ctx, `INSERT INTO user_settings (user_id, greeting_time) VALUES ($1,$2::time) ON CONFLICT(user_id) DO UPDATE SET greeting_time=$2::time`, userID, *req.MorningTime)
	}
	if req.NightTime != nil {
		h.pool.Exec(ctx, `INSERT INTO user_settings (user_id, bedtime_time) VALUES ($1,$2::time) ON CONFLICT(user_id) DO UPDATE SET bedtime_time=$2::time`, userID, *req.NightTime)
	}
	if req.MorningEnabled != nil {
		h.pool.Exec(ctx, `INSERT INTO push_settings (user_id, morning_enabled) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET morning_enabled=$2`, userID, *req.MorningEnabled)
	}
	if req.NightEnabled != nil {
		h.pool.Exec(ctx, `INSERT INTO push_settings (user_id, night_enabled) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET night_enabled=$2`, userID, *req.NightEnabled)
	}

	response.OK(c, gin.H{"updated": true})
}

// ═══ 女子日历 ═══

func (h *Handler) TodayCalendar(c *gin.Context) {
	cs := NewCalendarService(h.pool)
	event, err := cs.GetTodayEvent(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, event)
}

func (h *Handler) WeekCalendar(c *gin.Context) {
	cs := NewCalendarService(h.pool)
	events, err := cs.GetWeekEvents(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, events)
}

var _ = strconv.Atoi
