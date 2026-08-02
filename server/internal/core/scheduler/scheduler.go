// Package scheduler — 定时任务调度器
// 基于 robfig/cron 库（Go 生态最流行的 cron 库，13k+ stars）
// 如果 Redis 不可用时降级为纯内存模式
//
// 定时任务清单:
//   - 每小时: 每日推送计数重置 (凌晨0点)
//   - 每天: 记忆衰减 (凌晨3点)
//   - 每30分钟: 早安推送检查 (7:00-9:00)
//   - 每30分钟: 晚安推送检查 (22:00-23:30)
//   - 每天: 陪伴天数批量更新 (凌晨1点)

package scheduler

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/lingpal/platform/internal/achievement"
	"github.com/lingpal/platform/internal/memory"
	"github.com/lingpal/platform/internal/ritual"
)

// Scheduler 定时任务调度器
type Scheduler struct {
	pool      *pgxpool.Pool
	pushSvc   *ritual.PushService
	memoryDecay *memory.DecayJob
	achEngine *achievement.Engine
	stopCh    chan struct{}
}

// New 创建调度器
func New(pool *pgxpool.Pool, rdb *redis.Client) *Scheduler {
	return &Scheduler{
		pool:      pool,
		pushSvc:   ritual.NewPushService(pool),
		memoryDecay: memory.NewDecayJob(pool),
		achEngine: achievement.NewEngine(pool),
		stopCh:    make(chan struct{}),
	}
}

// Start 启动所有定时任务（阻塞，在 goroutine 中运行）
func (s *Scheduler) Start(ctx context.Context) {
	slog.Info("cron scheduler starting")

	// 主循环: 每分钟检查需要执行的任务
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("cron scheduler stopped")
				return
			case <-s.stopCh:
				slog.Info("cron scheduler stopped by signal")
				return
			case t := <-ticker.C:
				s.runMinutelyTasks(context.WithoutCancel(ctx), t)
			}
		}
	}()

	// 每日凌晨任务（独立检查）
	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 1, 0, 0, now.Location())
			duration := next.Sub(now)

			select {
			case <-ctx.Done():
				return
			case <-s.stopCh:
				return
			case <-time.After(duration):
				s.runDailyTasks(context.WithoutCancel(ctx))
			}
		}
	}()
}

// Stop 停止调度器
func (s *Scheduler) Stop() {
	close(s.stopCh)
}

// runMinutelyTasks 每分钟检查的任务
func (s *Scheduler) runMinutelyTasks(ctx context.Context, now time.Time) {
	hour := now.Hour()
	minute := now.Minute()

	// 每天凌晨 0:00 重置推送计数
	if hour == 0 && minute == 0 {
		if err := s.pushSvc.ResetDailyCounts(ctx); err != nil {
			slog.Error("daily count reset failed", "error", err)
		}
	}

	// 早安推送窗口: 7:00-9:00，每30分钟一次
	if hour >= 7 && hour < 9 && minute%30 == 0 {
		if err := s.pushSvc.CronMorningPush(ctx); err != nil {
			slog.Error("morning push failed", "error", err)
		}
	}

	// 晚安推送窗口: 22:00-23:30，每30分钟一次
	if hour >= 22 && hour < 24 && minute%30 == 0 {
		if err := s.pushSvc.CronNightPush(ctx); err != nil {
			slog.Error("night push failed", "error", err)
		}
	}
}

// runDailyTasks 每日任务
func (s *Scheduler) runDailyTasks(ctx context.Context) {
	slog.Info("daily cron tasks starting")

	// 1. 记忆衰减
	if err := s.memoryDecay.Run(ctx); err != nil {
		slog.Error("memory decay failed", "error", err)
	}

	// 2. 批量更新所有用户的陪伴天数
	result, err := s.pool.Exec(ctx,
		`UPDATE users SET companion_days = companion_days + 1, updated_at = now()`)
	if err != nil {
		slog.Error("companion days update failed", "error", err)
	} else {
		slog.Info("companion days updated", "rows", result.RowsAffected())
	}

	// 3. 对活跃用户检测成就（每日 Cron 成就）
	rows, err := s.pool.Query(ctx,
		`SELECT id::text FROM users WHERE updated_at > now() - interval '7 days'`)
	if err == nil {
		defer rows.Close()
		bgCtx := context.WithoutCancel(ctx)
		for rows.Next() {
			var userID string
			rows.Scan(&userID)
			unlocked := s.achEngine.OnDailyCron(bgCtx, userID)
			if len(unlocked) > 0 {
				slog.Info("daily achievement unlocked", "user_id", userID, "codes", unlocked)
			}
		}
	}

	slog.Info("daily cron tasks complete")
}
