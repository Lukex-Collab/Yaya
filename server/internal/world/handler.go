package world

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct { svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/world/pet", h.GetMyPet)
	rg.GET("/world/zones", h.GetZones)
	rg.GET("/world/explore/:zoneId", h.ExploreZone)
	rg.POST("/world/pet/feed", h.FeedPet)
	rg.GET("/world/pets/nearby", h.GetNearbyPets)
}

func (h *Handler) GetMyPet(c *gin.Context) {
	userID := c.GetString("user_id")
	pet, err := h.svc.GetMyPet(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, pet)
}

func (h *Handler) GetZones(c *gin.Context) {
	response.OK(c, h.svc.GetZones())
}

func (h *Handler) ExploreZone(c *gin.Context) {
	userID := c.GetString("user_id")
	zoneID := c.Param("zoneId")
	result, err := h.svc.ExploreZone(c.Request.Context(), userID, zoneID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, result)
}

func (h *Handler) FeedPet(c *gin.Context) {
	userID := c.GetString("user_id")
	result, _ := h.svc.FeedPet(c.Request.Context(), userID)
	response.OK(c, result)
}

func (h *Handler) GetNearbyPets(c *gin.Context) {
	response.OK(c, h.svc.GetNearbyPets())
}
