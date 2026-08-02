// Package voiceclone — 声音克隆服务 (Chatterbox TTS)
// "让牙牙用你自己的声音说话"
//
// 开源方案: Chatterbox TTS (GitHub, MIT license, 盲测63%胜ElevenLabs)
//   docker run -p 8888:8888 drycen/chatterbox-tts-server
//   API: POST /v1/audio/speech  (OpenAI TTS兼容)
//
// 用户场景:
//   录10秒音频 → 上传 → Chatterbox训练 → 牙牙用你的声音说话
//   "你的声音就是牙牙的声音" — 极度个性化的情感连接
package voiceclone

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool     *pgxpool.Pool
	ttsURL   string // Chatterbox TTS server URL
}

func NewService(pool *pgxpool.Pool, ttsURL string) *Service {
	if ttsURL == "" { ttsURL = "http://localhost:8888" }
	return &Service{pool: pool, ttsURL: ttsURL}
}

// AudioSample 用户上传的音频样本
type AudioSample struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	Duration int    `json:"duration_sec"`
	UploadedAt string `json:"uploaded_at"`
}

// VoiceModel 声音模型
type VoiceModel struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"` // training/ready/failed
	SampleCount int  `json:"sample_count"`
	CreatedAt string `json:"created_at"`
}

// SynthesizeResult TTS合成结果
type SynthesizeResult struct {
	AudioB64 string `json:"audio_base64"`
	Format   string `json:"format"`
	VoiceID  string `json:"voice_id"`
	DurationMs int  `json:"duration_ms"`
}

// UploadSample 上传语音样本（用于声音克隆训练）
func (s *Service) UploadSample(ctx context.Context, userID string, audioB64 string, durationSec int) (*AudioSample, error) {
	id := uuid.New().String()
	s.pool.Exec(ctx,
		`INSERT INTO voice_samples (id, user_id, duration_sec, status) VALUES ($1,$2,$3,'pending')`, id, userID, durationSec)

	// 如果积累了 >= 3 个样本，启动克隆训练
	var count int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM voice_samples WHERE user_id=$1 AND status='pending'`, userID).Scan(&count)
	if count >= 3 {
		go s.startCloning(context.Background(), userID)
	}

	return &AudioSample{ID: id, UserID: userID, Duration: durationSec, UploadedAt: time.Now().Format(time.RFC3339)}, nil
}

// startCloning 启动声音克隆训练（调用Chatterbox）
func (s *Service) startCloning(ctx context.Context, userID string) {
	voiceID := fmt.Sprintf("yaya-custom-%s", userID[:8])

	// 调用 Chatterbox TTS voice clone API
	payload := map[string]interface{}{
		"voice_name": voiceID,
		"user_id":    userID,
	}
	body, _ := json.Marshal(payload)
	go http.Post(s.ttsURL+"/v1/voices/clone", "application/json", bytes.NewReader(body))

	s.pool.Exec(ctx,
		`INSERT INTO voice_models (user_id, voice_id, name, status) VALUES ($1,$2,$3,'training')`,
		userID, voiceID, "我的声音")
}

// GetMyVoices 获取用户的音色列表
func (s *Service) GetMyVoices(ctx context.Context, userID string) ([]VoiceModel, error) {
	rows, _ := s.pool.Query(ctx,
		`SELECT COALESCE(voice_id,''), COALESCE(name,''), status, COALESCE(sample_count,0), created_at::text
		 FROM voice_models WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var voices []VoiceModel
	for rows.Next() { var v VoiceModel; rows.Scan(&v.ID, &v.Name, &v.Status, &v.SampleCount, &v.CreatedAt); voices = append(voices, v) }
	return voices, nil
}

// Synthesize 使用克隆音色合成语音
func (s *Service) Synthesize(ctx context.Context, userID, text, voiceID string) (*SynthesizeResult, error) {
	if voiceID == "" {
		// 检查是否有克隆音色
		var customVoice string
		s.pool.QueryRow(ctx, `SELECT voice_id FROM voice_models WHERE user_id=$1 AND status='ready' ORDER BY created_at DESC LIMIT 1`, userID).Scan(&customVoice)
		if customVoice != "" { voiceID = customVoice }
	}

	// 调用 Chatterbox OpenAI-compatible API
	payload := map[string]interface{}{
		"model": "chatterbox-tts",
		"input": text,
		"voice": voiceID,
		"response_format": "mp3",
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(s.ttsURL+"/v1/audio/speech", "application/json", bytes.NewReader(body))
	if err != nil { return nil, err }
	defer resp.Body.Close()

	audioBytes, _ := io.ReadAll(resp.Body)
	return &SynthesizeResult{
		AudioB64: base64.StdEncoding.EncodeToString(audioBytes),
		Format: "mp3", VoiceID: voiceID, DurationMs: len(audioBytes) * 8 / 128000 * 1000,
	}, nil
}

// CheckCloneStatus 检查克隆训练状态
func (s *Service) CheckCloneStatus(ctx context.Context, userID string) (map[string]interface{}, error) {
	var status string
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(status,'none') FROM voice_models WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, userID,
	).Scan(&status)
	if err != nil { return map[string]interface{}{"status": "none", "samples_needed": 3}, nil }
	return map[string]interface{}{"status": status}, nil
}
