package community

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/community/plaza", h.GetPlaza)
	rg.GET("/community/events", h.GetEvents)
	rg.POST("/community/visit/:friendId", h.VisitFriendPet)
	rg.POST("/community/gift/:friendId", h.SendGift)
}

func (h *Handler) GetPlaza(c *gin.Context) {
	plaza, _ := h.svc.GetPlaza(c.Request.Context(), c.GetString("user_id"))
	response.OK(c, plaza)
}
func (h *Handler) GetEvents(c *gin.Context) {
	feed, _ := h.svc.GetPlaza(c.Request.Context(), c.GetString("user_id"))
	response.OK(c, feed.Events)
}
func (h *Handler) VisitFriendPet(c *gin.Context) {
	result, _ := h.svc.VisitFriendPet(c.Request.Context(), c.GetString("user_id"), c.Param("friendId"))
	response.OK(c, result)
}
func (h *Handler) SendGift(c *gin.Context) {
	result, _ := h.svc.SendGift(c.Request.Context(), c.GetString("user_id"), c.Param("friendId"), c.Query("type"))
	response.OK(c, result)
}
var _ = strconv.Atoi
