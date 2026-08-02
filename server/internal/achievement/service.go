package achievement

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DefaultAchievements = []Achievement{
	{Code: "first_chat", Name: "初次见面", Desc: "完成第一次对话", Icon: "💬", Category: "milestone", Tier: 1, Target: 1},
	{Code: "seven_days", Name: "七日之约", Desc: "连续陪伴7天", Icon: "🌟", Category: "milestone", Tier: 2, Target: 7},
	{Code: "thirty_days", Name: "三十天老友", Desc: "连续陪伴30天", Icon: "💫", Category: "milestone", Tier: 3, Target: 30},
	{Code: "hundred_days", Name: "百天同行", Desc: "陪伴100天", Icon: "👑", Category: "milestone", Tier: 3, Target: 100},
	{Code: "chatterbox", Name: "话匣子", Desc: "累计对话1000条", Icon: "🗣️", Category: "special", Tier: 2, Target: 1000},
	{Code: "journal_master", Name: "日记达人", Desc: "写满30篇日记", Icon: "📖", Category: "special", Tier: 2, Target: 30},
	{Code: "morning_bird", Name: "早安鸟儿", Desc: "连续7天早安签到", Icon: "🌅", Category: "social", Tier: 1, Target: 7},
	{Code: "night_owl", Name: "晚安宝贝", Desc: "连续7天晚安打卡", Icon: "🌙", Category: "social", Tier: 1, Target: 7},
	{Code: "happy_week", Name: "情绪稳定", Desc: "连续7天情绪为happy", Icon: "😊", Category: "emotion", Tier: 2, Target: 7},
	{Code: "health_keeper", Name: "健康管理师", Desc: "连续记录经期3个月", Icon: "🩷", Category: "special", Tier: 2, Target: 3},
	{Code: "collector", Name: "收藏家", Desc: "解锁所有成就", Icon: "🏆", Category: "special", Tier: 3, Target: 0},
}

type Achievement struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Desc     string `json:"description"`
	Icon     string `json:"icon_emoji"`
	Category string `json:"category"`
	Tier     int    `json:"tier"`
	Target   int    `json:"target"`
}

type UserAchievement struct {
	Code       string     `json:"code"`
	Name       string     `json:"name"`
	Desc       string     `json:"description"`
	Icon       string     `json:"icon_emoji"`
	Category   string     `json:"category"`
	Tier       int        `json:"tier"`
	Progress   int        `json:"progress"`
	Target     int        `json:"target"`
	UnlockedAt *time.Time `json:"unlocked_at,omitempty"`
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) SeedAchievements(ctx context.Context) error {
	for _, a := range DefaultAchievements {
		s.pool.Exec(ctx,
			`INSERT INTO achievements (code, name, description, icon_emoji, category, tier) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
			a.Code, a.Name, a.Desc, a.Icon, a.Category, a.Tier,
		)
	}
	return nil
}

func (s *Service) GetAll(ctx context.Context, userID string) ([]UserAchievement, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT a.code, a.name, a.description, a.icon_emoji, a.category, a.tier,
		 COALESCE(ua.progress,0), a.target, ua.unlocked_at
		 FROM achievements a
		 LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
		 ORDER BY a.tier DESC, a.code`, userID,
	)
	if err != nil { return nil, err }
	defer rows.Close()

	var achievements []UserAchievement
	for rows.Next() {
		var ua UserAchievement
		rows.Scan(&ua.Code, &ua.Name, &ua.Desc, &ua.Icon, &ua.Category,
			&ua.Tier, &ua.Progress, &ua.Target, &ua.UnlockedAt)
		achievements = append(achievements, ua)
	}
	return achievements, nil
}

func (s *Service) CheckAndUnlock(ctx context.Context, userID, achievementCode string, increment int) (bool, error) {
	// 找到成就定义
	var achID string
	var target int
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, target FROM achievements WHERE code = $1`, achievementCode,
	).Scan(&achID, &target)
	if err != nil { return false, nil }

	// 更新进度
	_, err = s.pool.Exec(ctx,
		`INSERT INTO user_achievements (user_id, achievement_id, progress, target)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, achievement_id) DO UPDATE SET progress = user_achievements.progress + $3`,
		userID, achID, increment, target,
	)
	if err != nil { return false, err }

	// 检查是否刚刚达到目标
	var progress int
	var alreadyUnlocked bool
	s.pool.QueryRow(ctx,
		`SELECT progress, unlocked_at IS NOT NULL FROM user_achievements WHERE user_id=$1 AND achievement_id=$2`,
		userID, achID,
	).Scan(&progress, &alreadyUnlocked)

	if progress >= target && !alreadyUnlocked {
		now := time.Now()
		s.pool.Exec(ctx,
			`UPDATE user_achievements SET unlocked_at = $1 WHERE user_id=$2 AND achievement_id=$3`,
			now, userID, achID,
		)
		return true, nil
	}
	return false, nil
}
