package achievement

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EventBus 成就事件总线——任何模块调用即可触发成就检测
type EventBus struct {
	pool *pgxpool.Pool
}

func NewEventBus(pool *pgxpool.Pool) *EventBus { return &EventBus{pool: pool} }

// OnChatCompleted 对话完成后调用
func (b *EventBus) OnChatCompleted(ctx context.Context, userID string) {
	b.incr(ctx, userID, "first_chat", 1)
	b.incr(ctx, userID, "chatter_10", 1)
	b.incr(ctx, userID, "chatter_100", 1)
	b.incr(ctx, userID, "chatter_500", 1)
	b.incr(ctx, userID, "chatter_1000", 1)
	b.incr(ctx, userID, "chatter_5000", 1)
	b.tryUnlock(ctx, userID)
}

// OnJournalCreated 日记创建后调用
func (b *EventBus) OnJournalCreated(ctx context.Context, userID string) {
	b.incr(ctx, userID, "journal_1", 1)
	b.incr(ctx, userID, "journal_10", 1)
	b.incr(ctx, userID, "journal_30", 1)
	b.incr(ctx, userID, "journal_100", 1)
	b.tryUnlock(ctx, userID)
}

// OnExploreZone 探索区域后调用
func (b *EventBus) OnExploreZone(ctx context.Context, userID string, zoneID string) {
	b.incr(ctx, userID, "first_explore", 1)
	b.incr(ctx, userID, "explore_50", 1)
	// 记录已探索区域
	b.pool.Exec(ctx, `INSERT INTO explored_zones (user_id, zone_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, userID, zoneID)
	var zoneCount int
	b.pool.QueryRow(ctx, `SELECT COUNT(*) FROM explored_zones WHERE user_id=$1`, userID).Scan(&zoneCount)
	if zoneCount >= 5 { b.incr(ctx, userID, "zone_master", 1) }
	b.tryUnlock(ctx, userID)
}

// OnGemsEarned 获得宝石后调用
func (b *EventBus) OnGemsEarned(ctx context.Context, userID string, amount int) {
	b.incr(ctx, userID, "gems_1000", amount)
	b.tryUnlock(ctx, userID)
}

// OnCheckin 心情签到后调用
func (b *EventBus) OnCheckin(ctx context.Context, userID string, score int) {
	if score >= 4 { b.incr(ctx, userID, "happy_streak_3", 1) }
	b.tryUnlock(ctx, userID)
}

// OnGratitude 感恩日记后调用
func (b *EventBus) OnGratitude(ctx context.Context, userID string) {
	b.incr(ctx, userID, "first_gratitude", 1)
	b.tryUnlock(ctx, userID)
}

// OnEmotionRescue 情绪急救后调用
func (b *EventBus) OnEmotionRescue(ctx context.Context, userID string) {
	b.incr(ctx, userID, "rescue_used", 1)
	b.tryUnlock(ctx, userID)
}

// OnFriendAdded 添加好友后调用
func (b *EventBus) OnFriendAdded(ctx context.Context, userID string) {
	b.incr(ctx, userID, "first_friend", 1)
	var friendCount int
	b.pool.QueryRow(ctx, `SELECT COUNT(*) FROM friendships WHERE user_id=$1 AND status='accepted'`, userID).Scan(&friendCount)
	if friendCount >= 5 { b.incr(ctx, userID, "five_friends", 1) }
	b.tryUnlock(ctx, userID)
}

// OnFriendVisited 拜访好友后调用
func (b *EventBus) OnFriendVisited(ctx context.Context, userID string) {
	b.incr(ctx, userID, "first_visit", 1)
	b.tryUnlock(ctx, userID)
}

// OnReceivedVisit 被好友拜访后调用
func (b *EventBus) OnReceivedVisit(ctx context.Context, userID string) {
	b.incr(ctx, userID, "received_visit", 1)
	b.tryUnlock(ctx, userID)
}

// OnMorningRitual 早安后调用
func (b *EventBus) OnMorningRitual(ctx context.Context, userID string) {
	b.incr(ctx, userID, "morning_7", 1)
	b.tryUnlock(ctx, userID)
}

// OnNightRitual 晚安后调用
func (b *EventBus) OnNightRitual(ctx context.Context, userID string) {
	b.incr(ctx, userID, "night_7", 1)
	b.tryUnlock(ctx, userID)
}

// OnPeriodRecorded 经期记录后调用
func (b *EventBus) OnPeriodRecorded(ctx context.Context, userID string) {
	b.incr(ctx, userID, "period_3m", 1)
	b.tryUnlock(ctx, userID)
}

// OnBodyNoteAdded 身体笔记后调用
func (b *EventBus) OnBodyNoteAdded(ctx context.Context, userID string) {
	b.incr(ctx, userID, "body_note_10", 1)
	b.tryUnlock(ctx, userID)
}

// OnPetLevelUp 宠物升级后调用
func (b *EventBus) OnPetLevelUp(ctx context.Context, userID string, level int) {
	if level >= 10 { b.incr(ctx, userID, "pet_level_10", 1) }
	b.tryUnlock(ctx, userID)
}

// OnCompanionDaysChanged 陪伴天数变化后调用（Cron）
func (b *EventBus) OnCompanionDaysChanged(ctx context.Context, userID string, days int) {
	for _, d := range []struct{ code string; target int }{
		{"three_days", 3}, {"seven_days", 7}, {"fourteen_days", 14},
		{"thirty_days", 30}, {"sixty_days", 60}, {"hundred_days", 100}, {"year_one", 365},
	} {
		if days >= d.target { b.incr(ctx, userID, d.code, 0) }
	}
	b.tryUnlock(ctx, userID)
}

// incr 递增成就进度（如果未解锁）
func (b *EventBus) incr(ctx context.Context, userID, code string, amount int) {
	var achID string
	var target int
	if err := b.pool.QueryRow(ctx, `SELECT id::text, target FROM achievements WHERE code=$1`, code).Scan(&achID, &target); err != nil {
		return
	}
	b.pool.Exec(ctx,
		`INSERT INTO user_achievements (user_id, achievement_id, progress, target)
		 VALUES ($1,$2,$3,$4) ON CONFLICT(user_id,achievement_id)
		 DO UPDATE SET progress=LEAST(user_achievements.progress+$3, user_achievements.target)`,
		userID, achID, amount, target,
	)
}

// tryUnlock 检查所有成就并自动解锁达标的
func (b *EventBus) tryUnlock(ctx context.Context, userID string) {
	rows, err := b.pool.Query(ctx,
		`SELECT a.code FROM achievements a JOIN user_achievements ua ON a.id=ua.achievement_id
		 WHERE ua.user_id=$1 AND ua.progress >= ua.target AND ua.unlocked_at IS NULL`, userID)
	if err != nil { return }
	defer rows.Close()

	for rows.Next() {
		var code string
		rows.Scan(&code)
		b.pool.Exec(ctx,
			`UPDATE user_achievements SET unlocked_at=now(), is_notified=true
			 FROM achievements WHERE user_achievements.achievement_id=achievements.id
			 AND user_achievements.user_id=$1 AND achievements.code=$2`, userID, code)
		slog.Info("achievement unlocked", "user", userID, "achievement", code)
	}
}

// Create table for zone tracking
func EnsureExploredZonesTable(ctx context.Context, pool *pgxpool.Pool) {
	pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS explored_zones (
		user_id UUID REFERENCES users(id), zone_id VARCHAR(32),
		PRIMARY KEY(user_id, zone_id), created_at TIMESTAMPTZ DEFAULT now())`)
}
