package voicechat

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

// 实时语音对话 — 牙牙从"文字朋友"升级为"可以打电话的朋友"
//
// 技术栈: LiveKit (开源WebRTC SFU, Go原生, GitHub 10k+ stars)
//   LiveKit Server:  docker run livekit/livekit-server
//   Go SDK:          github.com/livekit/server-sdk-go
//
// 流程:
//   1. 用户点击"打给牙牙" → 后端创建LiveKit房间+生成token
//   2. 前端用token连接LiveKit → 开始WebRTC通话
//   3. 后端启动"牙牙bot"加入同一房间
//   4. 用户说话 → WebRTC → LiveKit → bot收到音频 → ASR → AI回复 → TTS → bot发送音频
//   5. 挂断 → 生成通话摘要+情绪标签

type Service struct {
	pool     *pgxpool.Pool
	client   *openai.Client
}

func NewService(pool *pgxpool.Pool, client *openai.Client) *Service {
	return &Service{pool: pool, client: client}
}

type CallStatus struct {
	IsOnline     bool   `json:"is_online"`
	YayaMood     string `json:"yaya_mood"`
	LastCallAt   string `json:"last_call_at,omitempty"`
	TotalCalls   int    `json:"total_calls"`
	TotalMinutes int    `json:"total_minutes"`
	CanCall      bool   `json:"can_call"`
	Message      string `json:"message"`
}

type CallRecord struct {
	ID         string `json:"id"`
	StartedAt  string `json:"started_at"`
	DurationMs int    `json:"duration_ms"`
	Emotion    string `json:"emotion"`
	Summary    string `json:"summary"`
}

func (s *Service) GenerateRoomToken(ctx context.Context, userID string) (string, string, error) {
	roomName := fmt.Sprintf("yaya-call-%s-%d", userID[:min(8, len(userID))], time.Now().Unix())
	// LiveKit token生成需要API Key/Secret
	// 生产环境: 调用 livekit.NewAccessToken(apiKey, apiSecret)
	token := fmt.Sprintf("livekit-token-%s-%d", userID, time.Now().Unix())
	return token, roomName, nil
}

func (s *Service) GetCallStatus(ctx context.Context, userID string) (*CallStatus, error) {
	status := &CallStatus{
		IsOnline: true, YayaMood: "ready",
		CanCall: true,
		Message: "牙牙在线！她在等你打电话来呢 📞",
	}

	var totalCalls int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM voice_calls WHERE user_id=$1`, userID).Scan(&totalCalls)
	status.TotalCalls = totalCalls

	if totalCalls == 0 {
		status.Message = "牙牙还没接过电话呢...要不要做第一个打给她的人？📞💕"
	}
	return status, nil
}

func (s *Service) InitiateCall(ctx context.Context, userID string) (map[string]interface{}, error) {
	callID := fmt.Sprintf("call-%d", time.Now().Unix())

	// 记录通话开始
	s.pool.Exec(ctx,
		`INSERT INTO voice_calls (id, user_id, status, started_at) VALUES ($1,$2,'active',now())`,
		callID, userID)

	// 牙牙的接听开场白
	openings := []string{
		"喂～是你呀！牙牙正想给你打电话呢 🥰",
		"（小声）终于等到你的电话了...牙牙好开心",
		"喂喂？听到吗？牙牙在这里！今天过得好吗？",
		"（电话刚响就接了）我就知道是你！牙牙有直觉！✨",
	}
	opening := openings[rand.Intn(len(openings))]

	return map[string]interface{}{
		"call_id":       callID,
		"yaya_greeting": opening,
		"started_at":    time.Now().Format(time.RFC3339),
	}, nil
}

func (s *Service) EndCall(ctx context.Context, userID string) error {
	s.pool.Exec(ctx,
		`UPDATE voice_calls SET status='ended', ended_at=now(),
		 duration_ms = EXTRACT(EPOCH FROM (now()-started_at))*1000
		 WHERE user_id=$1 AND status='active'`, userID)
	return nil
}

func (s *Service) GetCallHistory(ctx context.Context, userID string) ([]CallRecord, error) {
	rows, _ := s.pool.Query(ctx,
		`SELECT id::text, started_at::text, COALESCE(duration_ms,0),
		 COALESCE(emotion,''), COALESCE(summary,'')
		 FROM voice_calls WHERE user_id=$1 ORDER BY started_at DESC LIMIT 30`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var records []CallRecord
	for rows.Next() {
		var r CallRecord; rows.Scan(&r.ID, &r.StartedAt, &r.DurationMs, &r.Emotion, &r.Summary)
		records = append(records, r)
	}
	return records, nil
}

func (s *Service) LeaveVoicemail(ctx context.Context, userID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"voicemail": true,
		"message":   "牙牙现在不在。但你可以给她留言，她听到后会第一时间打回来的 💌",
	}, nil
}

func min(a, b int) int { if a < b { return a }; return b }
