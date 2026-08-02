package upload

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool      *pgxpool.Pool
	uploadDir string
	baseURL   string
	maxSize   int64
}

func NewService(pool *pgxpool.Pool, uploadDir, baseURL string) *Service {
	return &Service{
		pool:      pool,
		uploadDir: uploadDir,
		baseURL:   baseURL,
		maxSize:   10 * 1024 * 1024, // 10MB
	}
}

type UploadResult struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

func (s *Service) UploadFile(ctx context.Context, reader io.Reader, filename string, size int64, mimeType string, userID string) (*UploadResult, error) {
	if size > s.maxSize {
		return nil, fmt.Errorf("file too large: %d bytes (max %d)", size, s.maxSize)
	}

	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".bin"
	}

	allowed := map[string]bool{".jpg":true,".jpeg":true,".png":true,".gif":true,".mp3":true,".m4a":true,".aac":true,".wav":true}
	if !allowed[strings.ToLower(ext)] {
		return nil, fmt.Errorf("unsupported file type: %s", ext)
	}

	newName := fmt.Sprintf("%s_%s%s", userID[:min(8,len(userID))], uuid.New().String()[:8], ext)
	url := fmt.Sprintf("%s/%s/%s", s.baseURL, time.Now().Format("2006/01"), newName)

	// In production: write to MinIO/S3
	_ = url

	return &UploadResult{URL: url, Filename: newName, Size: size, MimeType: mimeType}, nil
}

func (s *Service) UploadAvatar(ctx context.Context, file multipart.File, header *multipart.FileHeader, userID string) (*UploadResult, error) {
	buf, _ := io.ReadAll(file)
	return s.UploadFile(ctx, strings.NewReader(string(buf)), header.Filename, header.Size, header.Header.Get("Content-Type"), userID)
}

func (s *Service) DeleteFile(ctx context.Context, key string) error { return nil }

func min(a, b int) int { if a < b { return a }; return b }
