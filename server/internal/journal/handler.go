package journal

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
	rg.POST("/journal/create", h.Create)
	rg.GET("/journal/list", h.List)
	rg.GET("/journal/:id", h.GetByID)
	rg.PUT("/journal/:id", h.Update)
	rg.DELETE("/journal/:id", h.Delete)
	rg.GET("/journal/mood-stats", h.MoodStats)
}

type createRequest struct {
	Content   string `json:"content" binding:"required"`
	IsPrivate bool   `json:"is_private"`
}

func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "content is required")
		return
	}
	userID := c.GetString("user_id")
	j, err := h.svc.Create(c.Request.Context(), userID, req.Content, req.IsPrivate)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Created(c, j)
}

func (h *Handler) List(c *gin.Context) {
	userID := c.GetString("user_id")
	emotion := c.Query("emotion")
	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		// 简化：使用默认值
	}
	journals, err := h.svc.List(c.Request.Context(), userID, emotion, page, pageSize)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, journals)
}

func (h *Handler) GetByID(c *gin.Context) {
	userID := c.GetString("user_id")
	journalID := c.Param("id")
	j, err := h.svc.GetByID(c.Request.Context(), userID, journalID)
	if err != nil {
		response.NotFound(c, "journal not found")
		return
	}
	response.OK(c, j)
}

func (h *Handler) Update(c *gin.Context) {
	userID := c.GetString("user_id")
	journalID := c.Param("id")
	var req createRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "content is required")
		return
	}
	if err := h.svc.Update(c.Request.Context(), userID, journalID, req.Content); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"updated": true})
}

func (h *Handler) Delete(c *gin.Context) {
	userID := c.GetString("user_id")
	journalID := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), userID, journalID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

func (h *Handler) MoodStats(c *gin.Context) {
	userID := c.GetString("user_id")
	period := c.DefaultQuery("period", "30 days")
	stats, err := h.svc.MoodStats(c.Request.Context(), userID, period)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, stats)
}
