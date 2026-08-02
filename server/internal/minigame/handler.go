// Package minigame — 牙牙小游戏中心
// 5款内置小游戏,游戏奖励直接发放到牙牙账户
// 游戏数据: 得分排行榜 · 宝石奖励 · 成就联动
package minigame

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/minigame/list", h.ListGames)
	rg.GET("/minigame/leaderboard/:gameId", h.GetLeaderboard)
	rg.POST("/minigame/score", h.SubmitScore)
	rg.GET("/minigame/my-stats", h.GetMyStats)
}

func (h *Handler) ListGames(c *gin.Context) {
	response.OK(c, h.svc.ListGames())
}

func (h *Handler) GetLeaderboard(c *gin.Context) {
	gameID := c.Param("gameId")
	board, _ := h.svc.GetLeaderboard(c.Request.Context(), gameID)
	response.OK(c, board)
}

func (h *Handler) SubmitScore(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		GameID string `json:"game_id" binding:"required"`
		Score  int    `json:"score" binding:"required"`
		Gems   int    `json:"gems"`
	}
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "game_id and score required"); return }
	result, _ := h.svc.SubmitScore(c.Request.Context(), userID, req.GameID, req.Score, req.Gems)
	response.OK(c, result)
}

func (h *Handler) GetMyStats(c *gin.Context) {
	userID := c.GetString("user_id")
	stats, _ := h.svc.GetMyStats(c.Request.Context(), userID)
	response.OK(c, stats)
}
