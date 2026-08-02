// Package capsule — 时间胶囊 & 生命故事
// 产品差异化: 牙牙不只陪你聊天，她在帮你书写人生
// 她会自动捕捉值得纪念的瞬间，生成"生命故事书"
// 用户回头看时，会看到"和牙牙一起走过的路"
package capsule

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/capsule/moments", h.GetMoments)
	rg.GET("/capsule/moments/:id", h.GetMoment)
	rg.POST("/capsule/seal", h.SealCapsule)          // 封存当前时期给未来自己
	rg.GET("/capsule/unseal", h.UnsealCapsule)        // 打开之前封存的时间胶囊
	rg.GET("/capsule/life-story", h.GetLifeStory)     // 牙牙为你写的人生叙事
}

func (h *Handler) GetMoments(c *gin.Context) {
	userID := c.GetString("user_id")
	moments, _ := h.svc.GetMoments(c.Request.Context(), userID, c.Query("period"))
	response.OK(c, moments)
}
func (h *Handler) GetMoment(c *gin.Context) {
	userID, id := c.GetString("user_id"), c.Param("id")
	m, _ := h.svc.GetMoment(c.Request.Context(), userID, id)
	response.OK(c, m)
}
func (h *Handler) SealCapsule(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ Message string `json:"message" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "message required"); return }
	capsule, _ := h.svc.SealCapsule(c.Request.Context(), userID, req.Message)
	response.OK(c, capsule)
}
func (h *Handler) UnsealCapsule(c *gin.Context) {
	userID := c.GetString("user_id")
	capsule, _ := h.svc.UnsealCapsule(c.Request.Context(), userID)
	response.OK(c, capsule)
}
func (h *Handler) GetLifeStory(c *gin.Context) {
	userID := c.GetString("user_id")
	story, _ := h.svc.GetLifeStory(c.Request.Context(), userID)
	response.OK(c, story)
}
