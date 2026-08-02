// Package onboarding — 新用户引导引擎
// 解决: "第一次打开不知道该做什么" — AI伴侣产品最致命的首次体验问题
//
// 引导流程 (7天渐进式):
//   Day 1: 认识牙牙 — 首次对话 + 选音色
//   Day 2: 照顾牙牙 — 喂食 + 抚摸
//   Day 3: 探索世界 — 进入灵伴世界 + 选区域
//   Day 5: 写出第一篇日记 — 牙牙帮你写
//   Day 7: 解锁第一个成就 + 邀请闺蜜
//
// 每个步骤都有牙牙的语音引导 + 动画 + 奖励

package onboarding

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// Step 引导步骤
type Step struct {
	Day         int    `json:"day"`
	Order       int    `json:"order"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"`
	ActionType  string `json:"action_type"`  // first_chat / pet_yaya / explore_world / write_journal / unlock_achievement / invite_friend / choose_voice / set_ritual
	ActionPath  string `json:"action_path"`   // 小程序页面路径或动作ID
	Reward      string `json:"reward"`
	Completed   bool   `json:"completed"`
	CompletedAt string `json:"completed_at,omitempty"`
}

// OnboardingStatus 引导状态
type OnboardingStatus struct {
	CurrentDay    int    `json:"current_day"`
	TotalSteps    int    `json:"total_steps"`
	CompletedSteps int   `json:"completed_steps"`
	ProgressPct   int    `json:"progress_pct"`
	NextStep      *Step  `json:"next_step"`
	AllSteps      []Step `json:"all_steps"`
	YayaMessage   string `json:"yaya_message"`
}

// 7天引导计划
var onboardingPlan = []Step{
	{Day:1, Order:1, Title:"和牙牙说第一句话", Description:"牙牙等你好久了！点击话筒，说出你的名字吧", Emoji:"💬", ActionType:"first_chat", ActionPath:"/pages/chat/chat", Reward:"牙牙的第一个专属表情"},
	{Day:1, Order:2, Title:"选择牙牙的声音", Description:"牙牙有5种声音哦～选一个你最喜欢的", Emoji:"🎤", ActionType:"choose_voice", ActionPath:"/api/v1/tts/voices", Reward:"解锁语音对话"},
	{Day:2, Order:3, Title:"喂牙牙吃饭", Description:"牙牙肚子饿了...给她喂点好吃的吧", Emoji:"🍖", ActionType:"pet_yaya", ActionPath:"/api/v1/care/tend", Reward:"牙牙开心度+20"},
	{Day:2, Order:4, Title:"摸摸牙牙的头", Description:"牙牙最喜欢被摸头了～试试长按她", Emoji:"🤚", ActionType:"pet_yaya", ActionPath:"/pages/home/home", Reward:"解锁抚摸互动"},
	{Day:3, Order:5, Title:"探索浆果森林", Description:"牙牙想带你去她最喜欢的地方", Emoji:"🗺️", ActionType:"explore_world", ActionPath:"/pages/world/world", Reward:"💎 星光石 ×1"},
	{Day:3, Order:6, Title:"给你的灵伴起名字", Description:"叫'云狐'太正式了...给她起个可爱的名字吧", Emoji:"✨", ActionType:"pet_yaya", ActionPath:"/pages/world-pet/world-pet", Reward:"命名证书"},
	{Day:5, Order:7, Title:"和牙牙一起写日记", Description:"今天发生了什么？告诉牙牙，她帮你写下来", Emoji:"📖", ActionType:"write_journal", ActionPath:"/pages/journal/journal", Reward:"解锁AI日记功能"},
	{Day:5, Order:8, Title:"设置早安时间", Description:"让牙牙每天早上准时叫你起床", Emoji:"🌅", ActionType:"set_ritual", ActionPath:"/api/v1/ritual/schedule", Reward:"早安仪式解锁"},
	{Day:7, Order:9, Title:"完成一周陪伴", Description:"牙牙已经陪你7天了！解锁你的第一个成就", Emoji:"🌟", ActionType:"unlock_achievement", ActionPath:"/pages/achievement/achievement", Reward:"七日之约成就 + 专属表情包"},
	{Day:7, Order:10, Title:"邀请闺蜜", Description:"一个人玩不够好玩？邀请闺蜜也领养一只牙牙吧！", Emoji:"👯", ActionType:"invite_friend", ActionPath:"/pages/profile/profile", Reward:"闺蜜专属配饰"},
}

func (s *Service) GetOnboardingStatus(ctx context.Context, userID string) (*OnboardingStatus, error) {
	// 计算注册天数
	var createdAt time.Time
	s.pool.QueryRow(ctx, `SELECT created_at FROM users WHERE id=$1`, userID).Scan(&createdAt)
	currentDay := int(time.Since(createdAt).Hours()/24) + 1
	if currentDay < 1 { currentDay = 1 }
	if currentDay > 7 { currentDay = 7 }

	// 加载完成状态
	completed := s.loadCompleted(ctx, userID)

	// 标记已完成步骤
	allSteps := make([]Step, len(onboardingPlan))
	copy(allSteps, onboardingPlan)
	completedCount := 0
	var nextStep *Step
	for i := range allSteps {
		if completed[allSteps[i].ActionType] {
			allSteps[i].Completed = true
			allSteps[i].CompletedAt = "已完成"
			completedCount++
		} else if nextStep == nil && allSteps[i].Day <= currentDay {
			ns := allSteps[i]
			nextStep = &ns
		}
	}

	// 如果全部完成了
	if nextStep == nil && completedCount == len(allSteps) {
		nextStep = &Step{Title: "全部完成！", Description: "你已经是一个成熟的牙牙主人了 🎉", Emoji: "🏆", ActionType: "completed"}
	}

	totalSteps := len(allSteps)
	pct := 0
	if totalSteps > 0 { pct = completedCount * 100 / totalSteps }

	return &OnboardingStatus{
		CurrentDay: currentDay, TotalSteps: totalSteps,
		CompletedSteps: completedCount, ProgressPct: pct,
		NextStep: nextStep, AllSteps: allSteps,
		YayaMessage: getOnboardingMessage(currentDay, completedCount),
	}, nil
}

func (s *Service) CompleteStep(ctx context.Context, userID, actionType string) error {
	s.pool.Exec(ctx,
		`INSERT INTO onboarding_progress (user_id, action_type, completed_at) VALUES ($1,$2,now()) ON CONFLICT DO NOTHING`,
		userID, actionType)
	return nil
}

func (s *Service) loadCompleted(ctx context.Context, userID string) map[string]bool {
	rows, _ := s.pool.Query(ctx,
		`SELECT action_type FROM onboarding_progress WHERE user_id=$1`, userID)
	completed := map[string]bool{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() { var a string; rows.Scan(&a); completed[a] = true }
	}
	return completed
}

func getOnboardingMessage(day, completed int) string {
	switch {
	case day == 1 && completed == 0:
		return "欢迎来到牙牙的世界！点击下方第一步开始吧～ 🎉"
	case day <= 2:
		return fmt.Sprintf("已经完成%d步了！牙牙好开心认识你 💕", completed)
	case day <= 5:
		return fmt.Sprintf("第%d天了！牙牙越来越了解你了 🌱", day)
	case completed >= 9:
		return "你已经是个超级牙牙主人了！🏆 接下来，去世界探险吧！"
	default:
		return "牙牙每天都有新东西想给你看 ✨"
	}
}
