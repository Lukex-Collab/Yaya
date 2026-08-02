package core

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// HealthStatus 健康检查结果
type HealthStatus struct {
	Healthy  bool              `json:"healthy"`
	Version  string            `json:"version"`
	Uptime   string            `json:"uptime"`
	Services map[string]string `json:"services"`
}

var startupTime string

func init() {
	startupTime = fmt.Sprintf("%d", 0) // 在 main 中设置
}

func SetStartupTime(t string) { startupTime = t }

// CheckAll 启动时全量依赖检查
func CheckAll(ctx context.Context, pool *pgxpool.Pool, rdb *redis.Client, deepSeekKey string) *HealthStatus {
	status := &HealthStatus{
		Healthy:  true,
		Version:  "1.0.0",
		Services: make(map[string]string),
	}

	// PostgreSQL
	if err := pool.Ping(ctx); err != nil {
		status.Services["postgresql"] = "DOWN: " + err.Error()
		status.Healthy = false
	} else {
		var version string
		pool.QueryRow(ctx, "SELECT version()").Scan(&version)
		status.Services["postgresql"] = "OK (pgvector)"
	}

	// Redis
	if rdb != nil {
		if err := rdb.Ping(ctx).Err(); err != nil {
			status.Services["redis"] = "DOWN: " + err.Error()
			status.Healthy = false
		} else {
			status.Services["redis"] = "OK"
		}
	} else {
		status.Services["redis"] = "DISABLED"
	}

	// DeepSeek
	if deepSeekKey == "" || deepSeekKey == "sk-your-key-here" {
		status.Services["deepseek"] = "MISSING_KEY — fallback mode enabled"
		slog.Warn("DEEPSEEK_API_KEY not configured, using offline fallback engine")
	} else {
		status.Services["deepseek"] = "OK (configured)"
	}

	// 数据库统计
	var userCount, msgCount, journalCount int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&userCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM messages").Scan(&msgCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM journals").Scan(&journalCount)
	status.Services["users"] = fmt.Sprintf("%d registered", userCount)
	status.Services["messages"] = fmt.Sprintf("%d total", msgCount)
	status.Services["journals"] = fmt.Sprintf("%d entries", journalCount)

	slog.Info("health check complete",
		"healthy", status.Healthy,
		"users", userCount,
		"messages", msgCount,
	)

	return status
}
