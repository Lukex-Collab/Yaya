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
	sim  *BLESimulator
}

func NewService(pool *pgxpool.Pool) *Service {
	sim := NewBLESimulator(pool)
	return &Service{pool: pool, sim: sim}
}

// StartSimulator 启动BLE模拟器
func (s *Service) StartSimulator(ctx context.Context) {
	s.sim.Start(ctx)
}

// StopSimulator 停止模拟器
func (s *Service) StopSimulator() {
	s.sim.Stop()
}

// GetSimulator 获取模拟器实例
func (s *Service) GetSimulator() *BLESimulator {
	return s.sim
}

// GetStatus 当前安全状态 + 所有设备
func (s *Service) GetStatus(ctx context.Context, userID string) (map[string]interface{}, error) {
	allSafe, msg := s.sim.IsAllSafe()
	devices := s.sim.GetDevices()

	deviceList := make([]map[string]interface{}, 0, len(devices))
	for _, dev := range devices {
		deviceList = append(deviceList, map[string]interface{}{
			"id":          dev.ID,
			"name":        dev.Name,
			"type":        dev.Type,
			"status":      dev.Status,
			"battery":     dev.Battery,
			"signal_rssi": dev.SignalRSSI,
			"is_open":     dev.IsOpen,
			"last_seen":   dev.LastSeen.Format(time.RFC3339),
		})
	}

	return map[string]interface{}{
		"mode":           "simulated",
		"simulator":      s.sim.GetActiveScenario() != "none",
		"active_scenario": s.sim.GetActiveScenario(),
		"all_safe":       allSafe,
		"safety_message": msg,
		"last_check":     time.Now().Format(time.RFC3339),
		"devices":        deviceList,
	}, nil
}

// RunScenario 运行模拟场景
func (s *Service) RunScenario(ctx context.Context, name string) error {
	return s.sim.StartScenario(ctx, name)
}

// GetHistory 安全事件日志
func (s *Service) GetHistory(ctx context.Context, userID string, limit int) ([]map[string]interface{}, error) {
	if s.pool == nil {
		return nil, nil
	}
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
	if s.pool == nil {
		return nil // 没有DB时静默跳过
	}
	detailJSON, _ := json.Marshal(detail)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO safety_logs (id, user_id, event_type, device_id, detail, is_simulated)
		 VALUES ($1, $2, $3, $4, $5, false)`,
		uuid.New().String(), userID, eventType, deviceID, detailJSON,
	)
	return err
}
