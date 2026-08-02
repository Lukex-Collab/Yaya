package yayacall

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/yayacall/schedule", h.GetSchedule)
	rg.POST("/yayacall/trigger", h.TriggerCall)
	rg.POST("/yayacall/answer", h.AnswerCall)
	rg.POST("/yayacall/reject", h.RejectCall)
	rg.GET("/yayacall/history", h.GetHistory)
}

func (h *Handler) GetSchedule(c *gin.Context) {
	schedule, _ := h.svc.GetSchedule(c.Request.Context(), c.GetString("user_id"))
	response.OK(c, schedule)
}
func (h *Handler) TriggerCall(c *gin.Context) {
	result, err := h.svc.TriggerCall(c.Request.Context(), c.GetString("user_id"))
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}
func (h *Handler) AnswerCall(c *gin.Context) {
	result, _ := h.svc.AnswerCall(c.Request.Context(), c.GetString("user_id"))
	response.OK(c, result)
}
func (h *Handler) RejectCall(c *gin.Context) {
	result, _ := h.svc.RejectCall(c.Request.Context(), c.GetString("user_id"))
	response.OK(c, result)
}
func (h *Handler) GetHistory(c *gin.Context) {
	rows, _ := h.svc.pool.Query(c.Request.Context(),
		`SELECT id, type, started_at::text, COALESCE(duration_ms,0), COALESCE(summary,'')
		 FROM voice_calls WHERE user_id=$1 AND type='yaya_called_you' ORDER BY started_at DESC LIMIT 20`, c.GetString("user_id"))
	if rows == nil { response.OK(c, []interface{}{}); return }
	defer rows.Close()
	var history []gin.H
	for rows.Next() { var id, typ, at, summary string; var dur int; rows.Scan(&id, &typ, &at, &dur, &summary); history = append(history, gin.H{"id":id,"type":typ,"at":at,"duration_ms":dur,"summary":summary}) }
	response.OK(c, history)
}
