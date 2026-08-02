package upload

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct {
	uploadDir string
	maxSize   int64 // bytes
}

func NewHandler(dir string) *Handler {
	os.MkdirAll(dir, 0755)
	return &Handler{uploadDir: dir, maxSize: 10 << 20} // 10MB
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/upload/voice", h.UploadVoice)
	rg.POST("/upload/image", h.UploadImage)
}

// 允许的文件类型
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

var allowedVoiceTypes = map[string]string{
	"audio/mp3":  ".mp3",
	"audio/mpeg": ".mp3",
	"audio/wav":  ".wav",
	"audio/aac":  ".aac",
	"audio/m4a":  ".m4a",
}

func (h *Handler) UploadVoice(c *gin.Context) {
	userID := c.GetString("user_id")
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "缺少文件")
		return
	}
	defer file.Close()

	ext, ok := allowedVoiceTypes[header.Header.Get("Content-Type")]
	if !ok {
		response.BadRequest(c, "不支持的音频格式，请上传 mp3/wav/aac/m4a")
		return
	}

	url, err := h.save(userID, file, header.Size, ext, "voice")
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"url": url, "size": header.Size})
}

func (h *Handler) UploadImage(c *gin.Context) {
	userID := c.GetString("user_id")
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "缺少文件")
		return
	}
	defer file.Close()

	ext, ok := allowedImageTypes[header.Header.Get("Content-Type")]
	if !ok {
		response.BadRequest(c, "不支持的图片格式，请上传 jpg/png/webp")
		return
	}

	url, err := h.save(userID, file, header.Size, ext, "image")
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"url": url, "size": header.Size})
}

func (h *Handler) save(userID string, file io.Reader, size int64, ext, category string) (string, error) {
	if size > h.maxSize {
		return "", fmt.Errorf("文件过大，最大10MB")
	}

	subDir := filepath.Join(h.uploadDir, category, userID)
	os.MkdirAll(subDir, 0755)

	filename := fmt.Sprintf("%s_%s%s", time.Now().Format("20060102_150405"), uuid.New().String()[:8], ext)
	path := filepath.Join(subDir, filename)

	dst, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	// 返回相对 URL
	return fmt.Sprintf("/uploads/%s/%s/%s", category, userID, filename), nil
}
