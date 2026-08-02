package safety

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// GetStatus 当前安全状态（模拟模式：永远安全）
func (s *Service) GetStatus(ctx context.Context, userID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"mode":       "simulated",
		"door_ok":    true,
		"window_ok":  true,
		"motion":     "none",
		"last_check": time.Now().Format(time.RFC3339),
	}, nil
}

// GetHistory 安全事件日志
func (s *Service) GetHistory(ctx context.Context, userID string, limit int) ([]map[string]interface{}, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id::text, event_type, COALESCE(device_id,''), detail, is_simulated, created_at
		 FROM safety_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var id, eventType, deviceID string
		var detail []byte
		var simulated bool
		var createdAt time.Time
		rows.Scan(&id, &eventType, &deviceID, &detail, &simulated, &createdAt)
		logs = append(logs, map[string]interface{}{
			"id":            id,
			"event_type":    eventType,
			"device_id":     deviceID,
			"is_simulated":  simulated,
			"created_at":    createdAt,
		})
	}
	return logs, nil
}

// RecordAlert 记录告警（硬件调用接口，预留）
func (s *Service) RecordAlert(ctx context.Context, userID, eventType, deviceID string, detail map[string]interface{}) error {
	detailJSON, _ := json.Marshal(detail)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO safety_logs (id, user_id, event_type, device_id, detail, is_simulated)
		 VALUES ($1, $2, $3, $4, $5, false)`,
		uuid.New().String(), userID, eventType, deviceID, detailJSON,
	)
	return err
}
