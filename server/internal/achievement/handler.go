package achievement

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct { svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/achievement/list", h.GetAll)
	rg.GET("/achievement/new", h.GetNewlyUnlocked)
	rg.GET("/achievement/progress", h.GetProgress)
}

// GetAll 全部成就+解锁状态
func (h *Handler) GetAll(c *gin.Context) {
	userID := c.GetString("user_id")
	list, err := h.svc.GetAll(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	// 统计
	unlocked := 0
	for _, a := range list {
		if a.UnlockedAt != nil { unlocked++ }
	}
	response.OK(c, gin.H{
		"achievements": list,
		"unlocked": unlocked,
		"total":    len(list),
	})
}

// GetNewlyUnlocked 获取新解锁的成就（未通知的）
func (h *Handler) GetNewlyUnlocked(c *gin.Context) {
	userID := c.GetString("user_id")
	engine := NewEngine(h.svc.pool)
	newOnes, err := engine.GetNewlyUnlocked(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"new_achievements": newOnes, "count": len(newOnes)})
}

// GetProgress 获取简化的成就进度（用于首页展示）
func (h *Handler) GetProgress(c *gin.Context) {
	userID := c.GetString("user_id")
	list, err := h.svc.GetAll(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	progress := make([]gin.H, 0)
	for _, a := range list {
		progress = append(progress, gin.H{
			"code":       a.Code,
			"name":       a.Name,
			"icon_emoji": a.Icon,
			"progress":   a.Progress,
			"target":     a.Target,
			"unlocked":   a.UnlockedAt != nil,
		})
	}
	response.OK(c, progress)
}
