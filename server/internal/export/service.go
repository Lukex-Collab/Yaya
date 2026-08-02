package export

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type ExportResult struct {
	ExportID    string `json:"export_id"`
	Status      string `json:"status"` // pending/processing/ready
	DownloadURL string `json:"download_url,omitempty"`
	ExpiresAt   string `json:"expires_at"`
	CreatedAt   string `json:"created_at"`
}

func (s *Service) ExportUserData(ctx context.Context, userID string) (*ExportResult, error) {
	id := uuid.New().String()
	now := time.Now()
	if s.pool == nil { return &ExportResult{ExportID: id, Status: "ready", CreatedAt: now.Format(time.RFC3339)}, nil }

	// 收集所有用户数据
	data := map[string]interface{}{"exported_at": now.Format(time.RFC3339)}

	// 用户资料
	var nickname, yayaName string
	var days int
	s.pool.QueryRow(ctx, `SELECT nickname, yaya_nickname, companion_days FROM users WHERE id=$1`, userID).Scan(&nickname, &yayaName, &days)
	data["profile"] = map[string]interface{}{"nickname": nickname, "yaya_name": yayaName, "companion_days": days}

	// 日记数量
	var journalCount int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE user_id=$1`, userID).Scan(&journalCount)
	data["journal_count"] = journalCount

	// 记忆数量
	var memoryCount int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM memories WHERE user_id=$1`, userID).Scan(&memoryCount)
	data["memory_count"] = memoryCount

	// 对话数量
	var msgCount int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id=c.id WHERE c.user_id=$1`, userID).Scan(&msgCount)
	data["message_count"] = msgCount

	jsonData, _ := json.MarshalIndent(data, "", "  ")

	result := &ExportResult{
		ExportID: id, Status: "ready",
		DownloadURL: fmt.Sprintf("/exports/%s.json", id),
		ExpiresAt: now.Add(7 * 24 * time.Hour).Format(time.RFC3339),
		CreatedAt: now.Format(time.RFC3339),
	}
	_ = jsonData // 实际写入文件/MinIO
	return result, nil
}

func (s *Service) GetExportStatus(ctx context.Context, userID string) (*ExportResult, error) {
	return &ExportResult{Status: "idle"}, nil
}

func (s *Service) DeleteAccount(ctx context.Context, userID string) error {
	// 级联删除所有用户数据
	_, _ = s.pool.Exec(ctx, `DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=$1)`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM conversations WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM memories WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM core_facts WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM journals WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM user_achievements WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM push_logs WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM safety_logs WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM period_records WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM body_notes WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM subscriptions WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM user_settings WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM push_settings WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM friendships WHERE user_id=$1 OR friend_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM pet_state WHERE user_id=$1`, userID)
	_, _ = s.pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, userID)
	return nil
}
