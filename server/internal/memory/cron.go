package memory

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DecayJob 记忆衰减定时任务
type DecayJob struct {
	pool *pgxpool.Pool
}

func NewDecayJob(pool *pgxpool.Pool) *DecayJob {
	return &DecayJob{pool: pool}
}

// Run 执行一次衰减（建议每天凌晨运行一次）
func (j *DecayJob) Run(ctx context.Context) error {
	start := time.Now()

	// 1. 衰减：重要性 < 5 且 30 天未访问的记忆
	result, err := j.pool.Exec(ctx,
		`UPDATE memories
		 SET decay_factor = decay_factor * 0.9,
		     last_accessed = now()
		 WHERE importance < 5
		   AND (last_accessed IS NULL OR last_accessed < now() - interval '30 days')
		   AND is_locked = false
		   AND decay_factor > 0.1`,
	)
	if err != nil {
		slog.Error("memory decay failed", "error", err)
		return err
	}
	decayedCount := result.RowsAffected()

	// 2. 归档：decay_factor < 0.15 且不是锁定的记忆 → 标记为 'forgotten'
	// （软删除方式，保留原始数据但不再检索）
	result2, err := j.pool.Exec(ctx,
		`UPDATE memories
		 SET memory_type = 'forgotten'
		 WHERE decay_factor < 0.15
		   AND is_locked = false
		   AND memory_type != 'forgotten'`,
	)
	if err != nil {
		slog.Error("memory archive failed", "error", err)
		return err
	}
	archivedCount := result2.RowsAffected()

	// 3. 合并重复记忆（相同 content 的记忆保留重要度最高的）
	result3, err := j.pool.Exec(ctx,
		`DELETE FROM memories a
		 USING memories b
		 WHERE a.content = b.content
		   AND a.importance < b.importance
		   AND a.user_id = b.user_id`,
	)
	if err != nil {
		slog.Warn("memory dedup failed", "error", err)
	} else {
		_ = result3.RowsAffected()
	}

	// 4. 核心事实过期检查（confidence < 0.3 的标记）
	j.pool.Exec(ctx,
		`UPDATE core_facts SET confidence = confidence * 0.8
		 WHERE updated_at < now() - interval '60 days'
		   AND confidence > 0.1`,
	)

	elapsed := time.Since(start)
	slog.Info("memory decay complete",
		"decayed", decayedCount,
		"archived", archivedCount,
		"elapsed", elapsed.String(),
	)

	return nil
}

// RunForUser 对单个用户执行衰减（用户每次聊天后触发）
func (j *DecayJob) RunForUser(ctx context.Context, userID string) error {
	_, err := j.pool.Exec(ctx,
		`UPDATE memories
		 SET decay_factor = decay_factor * 0.95
		 WHERE user_id = $1
		   AND importance < 3
		   AND (last_accessed IS NULL OR last_accessed < now() - interval '14 days')
		   AND is_locked = false`,
		userID,
	)
	return err
}
