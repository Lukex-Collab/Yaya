package wellness

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/wellness/checkin", h.Checkin)
	rg.GET("/wellness/checkin/today", h.GetToday)
	rg.GET("/wellness/checkin/history", h.GetHistory)
	rg.POST("/wellness/gratitude", h.AddGratitude)
	rg.GET("/wellness/gratitude", h.GetGratitudes)
	rg.GET("/wellness/report", h.GetReport)
	rg.GET("/wellness/care-status", h.GetCareStatus)
}

func (h *Handler) Checkin(c *gin.Context) {
	var req struct {
		Score int    `json:"score" binding:"required"`
		Note  string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "score required (1-5)")
		return
	}
	m, err := h.svc.Checkin(c.Request.Context(), c.GetString("user_id"), req.Score, req.Note)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, m)
}

func (h *Handler) GetToday(c *gin.Context) {
	m, err := h.svc.GetTodayCheckin(c.Request.Context(), c.GetString("user_id"))
	if err != nil {
		response.OK(c, gin.H{"checked_in": false})
		return
	}
	response.OK(c, m)
}

func (h *Handler) GetHistory(c *gin.Context) {
	moods, _ := h.svc.GetMoodHistory(c.Request.Context(), c.GetString("user_id"), 30)
	response.OK(c, moods)
}

func (h *Handler) AddGratitude(c *gin.Context) {
	var req struct{ Content string `json:"content" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "content required")
		return
	}
	g, err := h.svc.AddGratitude(c.Request.Context(), c.GetString("user_id"), req.Content)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Created(c, g)
}

func (h *Handler) GetGratitudes(c *gin.Context) {
	list, _ := h.svc.GetGratitudes(c.Request.Context(), c.GetString("user_id"), 20)
	response.OK(c, list)
}

func (h *Handler) GetReport(c *gin.Context) {
	period := c.DefaultQuery("period", "week")
	r, err := h.svc.GenerateReport(c.Request.Context(), c.GetString("user_id"), period)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, r)
}

func (h *Handler) GetCareStatus(c *gin.Context) {
	s, _ := h.svc.GetCareStatus(c.Request.Context(), c.GetString("user_id"))
	response.OK(c, s)
}
