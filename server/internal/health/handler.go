package health

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/health/period/record", h.RecordPeriod)
	rg.GET("/health/period/calendar", h.GetPeriodCalendar)
	rg.POST("/health/body-note", h.AddBodyNote)
	rg.GET("/health/body-notes", h.GetBodyNotes)
}

func (h *Handler) RecordPeriod(c *gin.Context) {
	var req struct {
		StartDate string `json:"start_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "start_date is required (YYYY-MM-DD)")
		return
	}
	userID := c.GetString("user_id")
	p, err := h.svc.RecordPeriod(c.Request.Context(), userID, req.StartDate)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Created(c, p)
}

func (h *Handler) GetPeriodCalendar(c *gin.Context) {
	userID := c.GetString("user_id")
	records, err := h.svc.GetPeriodCalendar(c.Request.Context(), userID, 6)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, records)
}

func (h *Handler) AddBodyNote(c *gin.Context) {
	var req struct {
		NoteType string `json:"note_type" binding:"required"`
		Detail   string `json:"detail"`
		Severity int    `json:"severity"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "note_type is required")
		return
	}
	if req.Severity < 1 { req.Severity = 1 }
	if req.Severity > 5 { req.Severity = 5 }
	userID := c.GetString("user_id")
	n, err := h.svc.AddBodyNote(c.Request.Context(), userID, req.NoteType, req.Detail, req.Severity)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Created(c, n)
}

func (h *Handler) GetBodyNotes(c *gin.Context) {
	userID := c.GetString("user_id")
	notes, err := h.svc.GetBodyNotes(c.Request.Context(), userID, 20)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, notes)
}
