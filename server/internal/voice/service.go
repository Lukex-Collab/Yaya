package voice

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service 语音处理服务
type Service struct {
	pool           *pgxpool.Pool
	deepSeekKey    string
	deepSeekBaseURL string
	uploadDir      string
}

func NewService(pool *pgxpool.Pool, deepSeekKey, baseURL string) *Service {
	return &Service{
		pool:           pool,
		deepSeekKey:    deepSeekKey,
		deepSeekBaseURL: baseURL,
		uploadDir:      "./uploads/voice/",
	}
}

// VoiceMessage 语音消息
type VoiceMessage struct {
	ID             string `json:"id"`
	UserID         string `json:"user_id"`
	ConversationID string `json:"conversation_id"`
	AudioURL       string `json:"audio_url"`
	Transcript     string `json:"transcript"`
	DurationMs     int    `json:"duration_ms"`
	FileSize       int    `json:"file_size"`
}

// ProcessVoice 处理语音上传 + 识别
func (s *Service) ProcessVoice(ctx context.Context, userID, convID string, audioData []byte, durationMs int) (*VoiceMessage, error) {
	msg := &VoiceMessage{
		ID:             uuid.New().String(),
		UserID:         userID,
		ConversationID: convID,
		AudioURL:       fmt.Sprintf("/uploads/voice/%s.mp3", userID+"_"+time.Now().Format("20060102150405")),
		DurationMs:     durationMs,
		FileSize:       len(audioData),
	}

	// 保存音频文件
	// os.WriteFile(msg.AudioURL, audioData, 0644)

	// 语音识别 — 使用 DeepSeek 或第三方 ASR
	transcript, err := s.transcribe(ctx, audioData)
	if err == nil && transcript != "" {
		msg.Transcript = transcript
	}

	// 写入数据库
	s.pool.Exec(ctx,
		`INSERT INTO voice_messages (id, user_id, conversation_id, audio_url, transcript, duration_ms, file_size)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		msg.ID, msg.UserID, msg.ConversationID, msg.AudioURL, msg.Transcript, msg.DurationMs, msg.FileSize,
	)

	return msg, nil
}

// transcribe 语音转文字
func (s *Service) transcribe(_ context.Context, _ []byte) (string, error) {
	// TODO: 接入微信同声传译 API 或火山引擎 ASR
	// 微信小程序端已自带语音识别能力（wx.getRecorderManager），本接口为后端留存
	return "", fmt.Errorf("asr not configured")
}

// UploadFile 通用文件上传（音频/图片）
func (s *Service) UploadFile(ctx context.Context, file multipart.File, header *multipart.FileHeader, userID string) (string, error) {
	var buf bytes.Buffer
	size, err := io.Copy(&buf, file)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}
	if size > 10*1024*1024 { // 10MB max
		return "", fmt.Errorf("file too large: %d bytes", size)
	}

	filename := fmt.Sprintf("%s_%s_%s", userID, time.Now().Format("20060102150405"), header.Filename)
	url := "/uploads/" + filename

	// os.WriteFile("./uploads/"+filename, buf.Bytes(), 0644)

	return url, nil
}

// 微信语音识别（JSAPI）
func (s *Service) wechatVoiceRecognition(ctx context.Context, audioData []byte, accessToken string) (string, error) {
	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/media/voice/translatecontent?access_token=%s&lfrom=zh_CN&lto=zh_CN", accessToken)

	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(audioData))
	req.Header.Set("Content-Type", "multipart/form-data")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return string(body), nil
}
