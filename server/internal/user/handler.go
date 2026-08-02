package user

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

// RegisterPublicRoutes 无需认证的路由
func (h *Handler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.POST("/auth/wechat/login", h.WeChatLogin)
}

// RegisterRoutes 需要认证的路由
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/user/profile", h.GetProfile)
	rg.PUT("/user/profile", h.UpdateProfile)
	rg.GET("/user/settings", h.GetSettings)
	rg.PUT("/user/settings", h.UpdateSettings)
}

type loginRequest struct {
	Code      string `json:"code" binding:"required"`
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatar_url"`
}

func (h *Handler) WeChatLogin(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "code is required")
		return
	}
	if req.Nickname == "" {
		req.Nickname = "牙牙的朋友"
	}

	result, err := h.svc.WeChatLogin(c.Request.Context(), req.Code, req.Nickname, req.AvatarURL)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, result)
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	user, err := h.svc.GetProfile(c.Request.Context(), userID)
	if err != nil {
		response.NotFound(c, "user not found")
		return
	}
	response.OK(c, user)
}

type updateProfileRequest struct {
	Nickname     *string `json:"nickname"`
	YayaNickname *string `json:"yaya_nickname"`
	AvatarURL    *string `json:"avatar_url"`
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request")
		return
	}
	userID := c.GetString("user_id")
	user, err := h.svc.UpdateProfile(c.Request.Context(), userID, req.Nickname, req.YayaNickname, req.AvatarURL)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, user)
}

func (h *Handler) GetSettings(c *gin.Context) {
	userID := c.GetString("user_id")
	settings, err := h.svc.GetSettings(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, settings)
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	var req UserSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid settings")
		return
	}
	userID := c.GetString("user_id")
	if err := h.svc.UpdateSettings(c.Request.Context(), userID, &req); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"updated": true})
}
