package yayaletter

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool, client *openai.Client) *Handler { return &Handler{svc: NewService(pool, client)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/yayaletter/this-week", h.GetThisWeek)
	rg.GET("/yayaletter/history", h.GetHistory)
	rg.GET("/yayaletter/:id", h.GetLetter)
}

func (h *Handler) GetThisWeek(c *gin.Context) {
	letter, err := h.svc.GenerateWeeklyLetter(c.Request.Context(), c.GetString("user_id"))
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, letter)
}
func (h *Handler) GetHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, _ := h.svc.pool.Query(c.Request.Context(),
		`SELECT id, week, title, created_at::text FROM weekly_letters WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, userID)
	if rows == nil { response.OK(c, []interface{}{}); return }
	defer rows.Close()
	var letters []gin.H
	for rows.Next() { var id, week, title, createdAt string; rows.Scan(&id, &week, &title, &createdAt); letters = append(letters, gin.H{"id":id,"week":week,"title":title,"created_at":createdAt}) }
	response.OK(c, letters)
}
func (h *Handler) GetLetter(c *gin.Context) {
	var content, ps string
	err := h.svc.pool.QueryRow(c.Request.Context(),
		`SELECT content, COALESCE(yaya_ps,'') FROM weekly_letters WHERE id=$1`, c.Param("id"),
	).Scan(&content, &ps)
	if err != nil { response.NotFound(c, "letter not found"); return }
	response.OK(c, gin.H{"content": content, "ps": ps})
}
