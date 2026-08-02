// Package export — 数据导出服务（GDPR/数据可携权）
package export

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/export/data", h.ExportData)
	rg.GET("/export/status", h.ExportStatus)
	rg.POST("/export/delete-account", h.DeleteAccount)
}

func (h *Handler) ExportData(c *gin.Context) {
	userID := c.GetString("user_id")
	result, err := h.svc.ExportUserData(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) ExportStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, _ := h.svc.GetExportStatus(c.Request.Context(), userID)
	response.OK(c, status)
}

func (h *Handler) DeleteAccount(c *gin.Context) {
	userID := c.GetString("user_id")
	err := h.svc.DeleteAccount(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, gin.H{"deleted": true, "msg": "账号已永久删除"})
}
