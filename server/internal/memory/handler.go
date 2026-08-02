package memory

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
	rg.POST("/memory/ingest", h.IngestMemory)
	rg.POST("/memory/search", h.SearchMemories)
	rg.GET("/memory/facts", h.GetCoreFacts)
	rg.DELETE("/memory/forget/:id", h.ForgetMemory)
}

type ingestRequest struct {
	Content     string `json:"content" binding:"required"`
	SourceMsgID string `json:"source_msg_id"`
}

func (h *Handler) IngestMemory(c *gin.Context) {
	var req ingestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "content is required")
		return
	}
	userID := c.GetString("user_id")
	if err := h.svc.IngestMemory(c.Request.Context(), userID, req.Content, req.SourceMsgID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"ingested": true})
}

type searchRequest struct {
	Query string `json:"query" binding:"required"`
	Limit int    `json:"limit"`
}

func (h *Handler) SearchMemories(c *gin.Context) {
	var req searchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "query is required")
		return
	}
	if req.Limit < 1 || req.Limit > 20 {
		req.Limit = 10
	}
	userID := c.GetString("user_id")
	memories, err := h.svc.SearchMemories(c.Request.Context(), userID, req.Query, req.Limit)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, memories)
}

func (h *Handler) GetCoreFacts(c *gin.Context) {
	userID := c.GetString("user_id")
	facts, err := h.svc.GetCoreFacts(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, facts)
}

func (h *Handler) ForgetMemory(c *gin.Context) {
	userID := c.GetString("user_id")
	memoryID := c.Param("id")
	if err := h.svc.ForgetMemory(c.Request.Context(), userID, memoryID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"forgotten": true})
}
