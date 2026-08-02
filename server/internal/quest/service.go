// Package quest — 每日任务挑战系统
package quest

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Quest struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Category    string `json:"category"` // chat/journal/mood/world/social
	Target      int    `json:"target"`
	Progress    int    `json:"progress"`
	RewardGems  int    `json:"reward_gems"`
	Completed   bool   `json:"completed"`
	Claimed     bool   `json:"claimed"`
}

// 每日任务池
var dailyQuestPool = []Quest{
	{Title:"聊聊天", Description:"和牙牙对话3次", Icon:"💬", Category:"chat", Target:3, RewardGems:10},
	{Title:"写日记", Description:"写一篇日记", Icon:"📝", Category:"journal", Target:1, RewardGems:10},
	{Title:"心情签到", Description:"完成每日心情签到", Icon:"❤️", Category:"mood", Target:1, RewardGems:10},
	{Title:"探索世界", Description:"派灵伴探索2次", Icon:"🗺️", Category:"world", Target:2, RewardGems:15},
	{Title:"说早安", Description:"和牙牙说早安", Icon:"🌅", Category:"ritual", Target:1, RewardGems:10},
	{Title:"说晚安", Description:"和牙牙说晚安", Icon:"🌙", Category:"ritual", Target:1, RewardGems:10},
	{Title:"感恩日记", Description:"写一条感恩记录", Icon:"🙏", Category:"gratitude", Target:1, RewardGems:10},
	{Title:"社交拜访", Description:"拜访一位好友的灵屿", Icon:"🏠", Category:"social", Target:1, RewardGems:15},
	{Title:"深度对话", Description:"和牙牙对话10条", Icon:"💭", Category:"chat", Target:10, RewardGems:20},
	{Title:"情绪记录", Description:"记录一种身体状态", Icon:"💪", Category:"health", Target:1, RewardGems:10},
}

// RefreshDaily 为所有活跃用户刷新每日任务（Cron调用）
func (s *Service) RefreshDaily(ctx context.Context) {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	today := time.Now().Format("2006-01-02")

	// 清除昨天的任务
	s.pool.Exec(ctx, `DELETE FROM daily_quests WHERE date < $1`, today)

	// 为活跃用户生成4个随机任务
	rows, _ := s.pool.Query(ctx,
		`SELECT id::text FROM users WHERE id IN (
			SELECT DISTINCT user_id FROM messages WHERE created_at > now()-interval '3 days'
		 ) LIMIT 500`)
	if rows == nil { return }
	defer rows.Close()

	count := 0
	pool := dailyQuestPool
	for rows.Next() {
		var uid string
		rows.Scan(&uid)

		// 随机选4个不重复的任务
		rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
		for i := 0; i < 4 && i < len(pool); i++ {
			q := pool[i]
			s.pool.Exec(ctx,
				`INSERT INTO daily_quests (id, user_id, title, description, icon, category, target, reward_gems, date)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
				uuid.New().String(), uid, q.Title, q.Description, q.Icon, q.Category, q.Target, q.RewardGems, today,
			)
		}
		count++
	}
	if count > 0 {
		fmt.Printf("quests refreshed for %d users\n", count)
	}
}

// GetTodayQuests 获取用户今日任务
func (s *Service) GetTodayQuests(ctx context.Context, userID string) ([]Quest, error) {
	today := time.Now().Format("2006-01-02")
	rows, err := s.pool.Query(ctx,
		`SELECT id, title, description, icon, category, target, COALESCE(progress,0), reward_gems, COALESCE(completed,false), COALESCE(claimed,false)
		 FROM daily_quests WHERE user_id=$1 AND date=$2 ORDER BY completed ASC, category`, userID, today)
	if err != nil { return nil, err }
	defer rows.Close()
	var quests []Quest
	for rows.Next() {
		var q Quest
		rows.Scan(&q.ID, &q.Title, &q.Description, &q.Icon, &q.Category, &q.Target, &q.Progress, &q.RewardGems, &q.Completed, &q.Claimed)
		quests = append(quests, q)
	}
	return quests, nil
}

// UpdateProgress 更新任务进度（事件驱动调用）
func (s *Service) UpdateProgress(ctx context.Context, userID, category string, amount int) {
	today := time.Now().Format("2006-01-02")
	s.pool.Exec(ctx,
		`UPDATE daily_quests SET progress=LEAST(progress+$1, target) WHERE user_id=$2 AND date=$3 AND category=$4`,
		amount, userID, today, category,
	)
	// 标记已完成
	s.pool.Exec(ctx,
		`UPDATE daily_quests SET completed=true WHERE user_id=$1 AND date=$2 AND progress>=target AND NOT completed`, userID, today)
}

// ClaimReward 领取奖励
func (s *Service) ClaimReward(ctx context.Context, userID, questID string) (int, error) {
	var reward int
	var completed, claimed bool
	err := s.pool.QueryRow(ctx,
		`UPDATE daily_quests SET claimed=true WHERE id=$1 AND user_id=$2 AND completed=true AND NOT claimed
		 RETURNING reward_gems`, questID, userID,
	).Scan(&reward)
	if err != nil {
		return 0, fmt.Errorf("无法领取：任务未完成或已领取")
	}
	_ = completed; _ = claimed
	// 发放宝石
	s.pool.Exec(ctx, `UPDATE pet_state SET gems=gems+$1 WHERE user_id=$2`, reward, userID)
	return reward, nil
}
