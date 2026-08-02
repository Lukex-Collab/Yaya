// Package social — 社交功能（灵伴世界好友/拜访/留言）
package social

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/social/friends", h.GetFriends)
	rg.POST("/social/friends", h.AddFriend)
	rg.DELETE("/social/friends/:id", h.RemoveFriend)
	rg.GET("/social/visits", h.GetVisits)
	rg.POST("/social/visit/:friendId", h.VisitFriend)
	rg.POST("/social/message/:friendId", h.LeaveMessage)
	rg.GET("/social/feed", h.GetFeed)
}

func (h *Handler) GetFriends(c *gin.Context) {
	userID := c.GetString("user_id")
	friends, _ := h.svc.GetFriends(c.Request.Context(), userID)
	response.OK(c, friends)
}

func (h *Handler) AddFriend(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct{ FriendID string `json:"friend_id" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "friend_id required"); return }
	friendship, err := h.svc.AddFriend(c.Request.Context(), userID, req.FriendID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, friendship)
}

func (h *Handler) RemoveFriend(c *gin.Context) {
	userID, friendID := c.GetString("user_id"), c.Param("id")
	h.svc.RemoveFriend(c.Request.Context(), userID, friendID)
	response.OK(c, gin.H{"removed": true})
}

func (h *Handler) GetVisits(c *gin.Context) {
	userID := c.GetString("user_id")
	visits, _ := h.svc.GetRecentVisits(c.Request.Context(), userID)
	response.OK(c, visits)
}

func (h *Handler) VisitFriend(c *gin.Context) {
	userID, friendID := c.GetString("user_id"), c.Param("friendId")
	result, err := h.svc.VisitFriend(c.Request.Context(), userID, friendID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) LeaveMessage(c *gin.Context) {
	userID, friendID := c.GetString("user_id"), c.Param("friendId")
	var req struct{ Message string `json:"message" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "message required"); return }
	msg, err := h.svc.LeaveMessage(c.Request.Context(), userID, friendID, req.Message)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, msg)
}

func (h *Handler) GetFeed(c *gin.Context) {
	userID := c.GetString("user_id")
	feed, _ := h.svc.GetFeed(c.Request.Context(), userID)
	response.OK(c, feed)
}
