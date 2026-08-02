package publicfeed

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/publicfeed/moments", h.GetFeed)          // 公共广场
	rg.POST("/publicfeed/like/:id", h.LikeMoment)      // 点赞
	rg.POST("/publicfeed/publish/:id", h.Publish)      // 发布日记到广场
	rg.GET("/publicfeed/today-best", h.GetTodayBest)   // 今日精选
	rg.GET("/publicfeed/weekly-best", h.GetWeeklyBest) // 本周TOP10
}

func (h *Handler) GetFeed(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	feed, _ := h.svc.GetPublicFeed(c.Request.Context(), page)
	response.OK(c, feed)
}
func (h *Handler) LikeMoment(c *gin.Context) {
	h.svc.LikeMoment(c.Request.Context(), c.Param("id"))
	response.OK(c, gin.H{"liked": true})
}
func (h *Handler) Publish(c *gin.Context) {
	h.svc.PublishToFeed(c.Request.Context(), c.Param("id"))
	response.OK(c, gin.H{"published": true})
}
func (h *Handler) GetTodayBest(c *gin.Context) {
	moment, _ := h.svc.GetTodayHighlight(c.Request.Context())
	response.OK(c, moment)
}
func (h *Handler) GetWeeklyBest(c *gin.Context) {
	best, _ := h.svc.GetWeeklyBest(c.Request.Context())
	response.OK(c, best)
}
