// Package search — 全局搜索（日记/记忆/对话）
package search

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/search", h.Search)
	rg.GET("/search/suggest", h.Suggest)
}

func (h *Handler) Search(c *gin.Context) {
	userID := c.GetString("user_id")
	query := c.Query("q")
	if query == "" {
		response.OK(c, gin.H{"query":"","total":0,"results":[]interface{}{}})
		return
	}
	results, err := h.svc.SearchAll(c.Request.Context(), userID, query)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, results)
}

func (h *Handler) Suggest(c *gin.Context) {
	userID := c.GetString("user_id")
	suggestions, _ := h.svc.GetSuggestions(c.Request.Context(), userID)
	response.OK(c, suggestions)
}
