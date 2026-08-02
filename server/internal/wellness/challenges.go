// Package wellness — 健康挑战引擎补充
// 打卡挑战: 连续7天早睡→牙牙换新衣·连续运动→宝石奖励
package wellness

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ChallengeService struct{ pool *pgxpool.Pool }
func NewChallengeService(pool *pgxpool.Pool) *ChallengeService { return &ChallengeService{pool} }

type Challenge struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"`
	Target      int    `json:"target"`      // 目标天数
	Progress    int    `json:"progress"`     // 当前进度
	Reward      string `json:"reward"`
	Category    string `json:"category"`    // sleep/step/water/mood
	Completed   bool   `json:"completed"`
}

type DailySteps struct {
	TodaySteps     int    `json:"today_steps"`
	YesterdaySteps int    `json:"yesterday_steps"`
	WeekAvg        int    `json:"week_avg"`
	GemsEarned     int    `json:"gems_earned_today"`
	Goal           int    `json:"daily_goal"`       // 8000步
	ProgressPct    int    `json:"progress_pct"`
	YayaMessage    string `json:"yaya_message"`
}

// GetActiveChallenges 获取活跃挑战
func (cs *ChallengeService) GetActiveChallenges(ctx context.Context, userID string) []Challenge {
	challenges := []Challenge{
		{ID:"sleep_7", Title:"早睡挑战", Description:"连续7天23点前睡觉", Emoji:"🌙", Target:7, Reward:"牙牙新睡衣👘", Category:"sleep"},
		{ID:"steps_7", Title:"万步挑战", Description:"连续7天走满8000步", Emoji:"🏃", Target:7, Reward:"💎 100宝石", Category:"step"},
		{ID:"water_7", Title:"喝水挑战", Description:"连续7天打卡喝水8杯", Emoji:"💧", Target:7, Reward:"牙牙专属水杯🥤", Category:"water"},
		{ID:"mood_7", Title:"好心情周", Description:"连续7天心情签到≥3分", Emoji:"😊", Target:7, Reward:"牙牙开心表情包🎭", Category:"mood"},
		{ID:"diary_7", Title:"日记周", Description:"连续7天写日记", Emoji:"📖", Target:7, Reward:"回忆相册解锁📸", Category:"diary"},
		{ID:"morning_7", Title:"早起挑战", Description:"连续7天7:30前起床", Emoji:"🌅", Target:7, Reward:"冥想引导语音🧘", Category:"sleep"},
	}
	for i := range challenges {
		var progress int
		cs.pool.QueryRow(ctx,
			`SELECT COALESCE(MAX(progress),0) FROM challenge_progress WHERE user_id=$1 AND challenge_id=$2`, userID, challenges[i].ID,
		).Scan(&progress)
		challenges[i].Progress = progress
		if progress >= challenges[i].Target {
			challenges[i].Completed = true
		}
	}
	return challenges
}

// CheckInChallenge 打卡挑战
func (cs *ChallengeService) CheckInChallenge(ctx context.Context, userID, challengeID string) (map[string]interface{}, error) {
	cs.pool.Exec(ctx,
		`INSERT INTO challenge_progress (user_id, challenge_id, progress, last_checkin) VALUES ($1,$2,1,now()) ON CONFLICT (user_id,challenge_id)
		 DO UPDATE SET progress=challenge_progress.progress+1, last_checkin=now()`,
		userID, challengeID)

	// 获取更新后的进度
	var progress int
	cs.pool.QueryRow(ctx,
		`SELECT progress FROM challenge_progress WHERE user_id=$1 AND challenge_id=$2`, userID, challengeID,
	).Scan(&progress)

	msg := fmt.Sprintf("✅ 打卡成功！当前进度 %d 天，坚持就是胜利！", progress)
	return map[string]interface{}{"checked_in": true, "progress": progress, "message": msg}, nil
}

// UpdateSteps 更新步数（从微信运动回调）
func (cs *ChallengeService) UpdateSteps(ctx context.Context, userID string, steps int) (*DailySteps, error) {
	goal := 8000
	pct := steps * 100 / goal
	if pct > 100 { pct = 100 }

	// 步数兑换宝石: 每1000步=1💎
	gems := steps / 1000

	// 更新宠物宝石
	cs.pool.Exec(ctx, `UPDATE pet_state SET gems = gems + $1 WHERE user_id=$2`, gems, userID)

	// 更新步数挑战进度
	if steps >= goal {
		cs.CheckInChallenge(ctx, userID, "steps_7")
	}

	var yesterdaySteps int
	cs.pool.QueryRow(ctx,
		`SELECT COALESCE(steps,0) FROM daily_steps WHERE user_id=$1 AND date = CURRENT_DATE-1`, userID,
	).Scan(&yesterdaySteps)

	cs.pool.Exec(ctx,
		`INSERT INTO daily_steps (user_id, date, steps) VALUES ($1,CURRENT_DATE,$2) ON CONFLICT (user_id,date) DO UPDATE SET steps=$2`,
		userID, steps)

	msg := "今天走得不错！💪"
	if pct >= 100 { msg = "目标达成！牙牙为你骄傲 🎉 送你" + fmt.Sprintf("%d💎", gems) }
	if steps < 2000 { msg = "今天步数有点少...要不要出门走走？牙牙陪你 🚶" }

	return &DailySteps{
		TodaySteps: steps, YesterdaySteps: yesterdaySteps, Goal: goal,
		ProgressPct: pct, GemsEarned: gems, YayaMessage: msg,
	}, nil
}

// GetTodaySteps 获取今日步数
func (cs *ChallengeService) GetTodaySteps(ctx context.Context, userID string) (*DailySteps, error) {
	steps := &DailySteps{Goal: 8000}
	cs.pool.QueryRow(ctx,
		`SELECT COALESCE(steps,0) FROM daily_steps WHERE user_id=$1 AND date=CURRENT_DATE`, userID,
	).Scan(&steps.TodaySteps)
	steps.ProgressPct = steps.TodaySteps * 100 / steps.Goal
	if steps.ProgressPct > 100 { steps.ProgressPct = 100 }
	steps.GemsEarned = steps.TodaySteps / 1000
	steps.YayaMessage = "牙牙在等你今天的步数呢～出门走走？🚶"
	return steps, nil
}
