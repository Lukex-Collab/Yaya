package achievement

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Engine 事件驱动的成就检测引擎
// 订阅事件总线，实时检测成就进度并触发解锁
type Engine struct {
	pool *pgxpool.Pool
	svc  *Service
}

func NewEngine(pool *pgxpool.Pool) *Engine {
	return &Engine{pool: pool, svc: NewService(pool)}
}

// ═══════════ 检测方法 — 由事件总线调用 ═══════════

// OnChatCompleted 对话完成 → 检测 "初次见面" / "话匣子"
func (e *Engine) OnChatCompleted(ctx context.Context, userID string) []string {
	var unlocked []string
	unlocked = append(unlocked, e.checkFirstChat(ctx, userID)...)
	unlocked = append(unlocked, e.checkChatterbox(ctx, userID)...)
	return unlocked
}

// OnJournalCreated 日记创建 → 检测 "日记达人"
func (e *Engine) OnJournalCreated(ctx context.Context, userID string) []string {
	return e.checkJournalMaster(ctx, userID)
}

// OnDailyCron 每日 Cron → 检测天数类成就 + 情绪稳定
func (e *Engine) OnDailyCron(ctx context.Context, userID string) []string {
	var unlocked []string
	unlocked = append(unlocked, e.checkDaysMilestones(ctx, userID)...)
	unlocked = append(unlocked, e.checkMorningStreak(ctx, userID)...)
	unlocked = append(unlocked, e.checkNightStreak(ctx, userID)...)
	unlocked = append(unlocked, e.checkHappyWeek(ctx, userID)...)
	return unlocked
}

// OnPeriodRecorded 经期记录 → 检测 "健康管理师"
func (e *Engine) OnPeriodRecorded(ctx context.Context, userID string) []string {
	return e.checkHealthKeeper(ctx, userID)
}

// ═══════════ 各成就检测逻辑 ═══════════

func (e *Engine) checkFirstChat(ctx context.Context, userID string) []string {
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM messages WHERE user_id=$1 AND role='user'`, userID,
	).Scan(&count)

	if count >= 1 {
		if ok, _ := e.svc.CheckAndUnlock(ctx, userID, "first_chat", 1); ok {
			return []string{"first_chat"}
		}
	}
	return nil
}

func (e *Engine) checkChatterbox(ctx context.Context, userID string) []string {
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM messages WHERE user_id=$1 AND role='user'`, userID,
	).Scan(&count)

	// 更新进度
	e.svc.CheckAndUnlock(ctx, userID, "chatterbox", 1)

	if count >= 1000 {
		var unlocked bool
		e.pool.QueryRow(ctx,
			`SELECT unlocked_at IS NOT NULL FROM user_achievements WHERE user_id=$1 AND achievement_id=(SELECT id FROM achievements WHERE code='chatterbox')`,
			userID,
		).Scan(&unlocked)
		if unlocked {
			return []string{"chatterbox"}
		}
	}
	return nil
}

func (e *Engine) checkJournalMaster(ctx context.Context, userID string) []string {
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM journals WHERE user_id=$1`, userID,
	).Scan(&count)

	if ok, _ := e.svc.CheckAndUnlock(ctx, userID, "journal_master", 1); ok {
		return []string{"journal_master"}
	}
	_ = count
	return nil
}

func (e *Engine) checkDaysMilestones(ctx context.Context, userID string) []string {
	var days int
	e.pool.QueryRow(ctx,
		`SELECT companion_days FROM users WHERE id=$1`, userID,
	).Scan(&days)

	var unlocked []string

	// 递增更新所有天数成就进度
	for _, code := range []string{"seven_days", "thirty_days", "hundred_days"} {
		if ok, _ := e.svc.CheckAndUnlock(ctx, userID, code, 1); ok {
			unlocked = append(unlocked, code)
		}
	}
	return unlocked
}

func (e *Engine) checkMorningStreak(ctx context.Context, userID string) []string {
	// 检查今天是否已有早安打卡
	today := time.Now().Format("2006-01-02")
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM push_logs WHERE user_id=$1 AND type='morning' AND created_at::date=$2::date`,
		userID, today,
	).Scan(&count)

	if count > 0 {
		if ok, _ := e.svc.CheckAndUnlock(ctx, userID, "morning_bird", 1); ok {
			return []string{"morning_bird"}
		}
	}
	return nil
}

func (e *Engine) checkNightStreak(ctx context.Context, userID string) []string {
	today := time.Now().Format("2006-01-02")
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM push_logs WHERE user_id=$1 AND type='night' AND created_at::date=$2::date`,
		userID, today,
	).Scan(&count)

	if count > 0 {
		if ok, _ := e.svc.CheckAndUnlock(ctx, userID, "night_owl", 1); ok {
			return []string{"night_owl"}
		}
	}
	return nil
}

func (e *Engine) checkHappyWeek(ctx context.Context, userID string) []string {
	// 检查最近7天日记情绪是否都是happy
	today := time.Now().Format("2006-01-02")
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM journals
		 WHERE user_id=$1 AND emotion='happy' AND created_at >= $2::date - interval '7 days'`,
		userID, today,
	).Scan(&count)

	if count >= 7 {
		if ok, _ := e.svc.CheckAndUnlock(ctx, userID, "happy_week", 7); ok {
			return []string{"happy_week"}
		}
	}
	return nil
}

func (e *Engine) checkHealthKeeper(ctx context.Context, userID string) []string {
	// 检查是否连续记录了3个月经期
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT DATE_TRUNC('month', start_date)) FROM period_records WHERE user_id=$1`,
		userID,
	).Scan(&count)

	if count >= 3 {
		if ok, _ := e.svc.CheckAndUnlock(ctx, userID, "health_keeper", 3); ok {
			return []string{"health_keeper"}
		}
	}
	return nil
}

// ═══════════ 检查"收藏家"（所有成就解锁后） ═══════════

func (e *Engine) CheckCollector(ctx context.Context, userID string) (bool, error) {
	// 检查是否所有成就都已解锁（除了收藏家自己）
	count := 0
	e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM user_achievements WHERE user_id=$1 AND unlocked_at IS NOT NULL`,
		userID,
	).Scan(&count)

	totalAchievements := len(DefaultAchievements) - 1
	if count >= totalAchievements {
		return e.svc.CheckAndUnlock(ctx, userID, "collector", 1)
	}
	return false, nil
}

// ═══════════ 通知里程碑事件 ═══════════

// GetNewlyUnlocked 获取用户的新解锁成就（is_notified=false）
func (e *Engine) GetNewlyUnlocked(ctx context.Context, userID string) ([]UserAchievement, error) {
	rows, err := e.pool.Query(ctx,
		`SELECT a.code, a.name, a.description, a.icon_emoji, a.category, a.tier,
		 ua.progress, a.target, ua.unlocked_at
		 FROM achievements a
		 JOIN user_achievements ua ON a.id = ua.achievement_id
		 WHERE ua.user_id=$1 AND ua.unlocked_at IS NOT NULL AND ua.is_notified = false
		 ORDER BY ua.unlocked_at DESC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var achievements []UserAchievement
	for rows.Next() {
		var ua UserAchievement
		rows.Scan(&ua.Code, &ua.Name, &ua.Desc, &ua.Icon, &ua.Category,
			&ua.Tier, &ua.Progress, &ua.Target, &ua.UnlockedAt)
		achievements = append(achievements, ua)
	}

	// 标记为已通知
	for _, a := range achievements {
		e.pool.Exec(ctx,
			`UPDATE user_achievements SET is_notified=true WHERE user_id=$1 AND achievement_id=(SELECT id FROM achievements WHERE code=$2)`,
			userID, a.Code,
		)
	}

	return achievements, nil
}

// MilestoneNotification 里程碑通知内容
type MilestoneNotification struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IconEmoji   string `json:"icon_emoji"`
	UnlockedAt  string `json:"unlocked_at"`
}

// HandleEvent 事件总线回调入口
// 格式: {"user_id":"xxx", ...}
func (e *Engine) HandleEvent(ctx context.Context, eventType string, payload []byte) error {
	var data map[string]interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	userID, _ := data["user_id"].(string)
	if userID == "" {
		return nil
	}

	var unlocked []string

	switch eventType {
	case "chat.completed":
		unlocked = e.OnChatCompleted(ctx, userID)
	case "journal.created":
		unlocked = e.OnJournalCreated(ctx, userID)
	case "ritual.morning":
		unlocked = e.OnDailyCron(ctx, userID)
	case "ritual.night":
		unlocked = e.OnDailyCron(ctx, userID)
	case "health.reminder":
		unlocked = e.OnPeriodRecorded(ctx, userID)
	}

	if len(unlocked) > 0 {
		slog.Info("achievements unlocked", "user_id", userID, "codes", unlocked)
		// 检查收藏家
		go e.CheckCollector(context.Background(), userID)
	}

	return nil
}
