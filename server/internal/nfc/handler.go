// Package nfc — NFC标签绑定服务
// "买一只实体宠物，NFC一碰绑定到你的账号，全世界只有你有"
// 产品核心护城河 #1: 唯一ID绑定
package nfc

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct{ svc *Service }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{svc: NewService(pool)} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/nfc/bind", h.BindNFC)
	rg.GET("/nfc/mypet", h.GetMyNFCInfo)
	rg.POST("/nfc/unbind", h.UnbindNFC)
	rg.POST("/nfc/verify", h.VerifyNFC)
}

func (h *Handler) BindNFC(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		NfcUID   string `json:"nfc_uid" binding:"required"`
		Species  string `json:"species" binding:"required"`
		PetName  string `json:"pet_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "nfc_uid and species required"); return }
	if req.PetName == "" { req.PetName = speciesDefaultName(req.Species) }

	result, err := h.svc.BindNFC(c.Request.Context(), userID, req.NfcUID, req.Species, req.PetName)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func (h *Handler) GetMyNFCInfo(c *gin.Context) {
	userID := c.GetString("user_id")
	info, err := h.svc.GetMyNFCInfo(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, info)
}

func (h *Handler) UnbindNFC(c *gin.Context) {
	userID := c.GetString("user_id")
	err := h.svc.UnbindNFC(c.Request.Context(), userID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, gin.H{"unbound": true, "msg": "NFC已解绑，玩具可以重新配对"})
}

func (h *Handler) VerifyNFC(c *gin.Context) {
	var req struct{ NfcUID string `json:"nfc_uid" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "nfc_uid required"); return }
	result, err := h.svc.VerifyNFC(c.Request.Context(), req.NfcUID)
	if err != nil { response.InternalError(c, err.Error()); return }
	response.OK(c, result)
}

func speciesDefaultName(species string) string {
	names := map[string]string{"云狐":"小狐狸","墨猫":"小黑猫","芽龙":"小龙","泡兔":"小兔子","岩熊":"小熊"}
	if n, ok := names[species]; ok { return n }
	return "灵伴"
}
