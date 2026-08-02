package ritual

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	svc  *Service
	pool *pgxpool.Pool
}

func NewHandler(svc *Service, pool *pgxpool.Pool) *Handler {
	return &Handler{svc: svc, pool: pool}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/ritual/good-morning", h.GoodMorning)
	rg.POST("/ritual/good-night", h.GoodNight)
	rg.GET("/ritual/bedtime-story", h.BedtimeStory)
}

type ritualResponse struct {
	Greeting string `json:"greeting"`
}

func (h *Handler) getNames(ctx context.Context, userID string) (string, string) {
	var nickname, yayaName string
	h.pool.QueryRow(ctx,
		`SELECT nickname, yaya_nickname FROM users WHERE id = $1`, userID,
	).Scan(&nickname, &yayaName)
	if nickname == "" { nickname = "主人" }
	if yayaName == "" { yayaName = "牙牙" }
	return nickname, yayaName
}

func (h *Handler) GoodMorning(c *gin.Context) {
	userID := c.GetString("user_id")
	nickname, yayaName := h.getNames(c.Request.Context(), userID)
	greeting, err := h.svc.GoodMorning(c.Request.Context(), userID, nickname, yayaName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"greeting": greeting})
}

func (h *Handler) GoodNight(c *gin.Context) {
	userID := c.GetString("user_id")
	nickname, yayaName := h.getNames(c.Request.Context(), userID)
	greeting, err := h.svc.GoodNight(c.Request.Context(), userID, nickname, yayaName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"greeting": greeting})
}

func (h *Handler) BedtimeStory(c *gin.Context) {
	userID := c.GetString("user_id")
	_, yayaName := h.getNames(c.Request.Context(), userID)
	story, err := h.svc.BedtimeStory(c.Request.Context(), yayaName)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"story": story})
}
