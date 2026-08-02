package bidcare

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// 双向守护理系统 — 牙牙也需要你
// 这是情感闭环的关键:
//  用户照顾牙牙（喂食/抚摸/哄睡）
//     ↓
//  牙牙感到被爱 → 更能守护用户
//     ↓
//  牙牙也会"担心"用户（主动关心）
//     ↓
//  用户安抚牙牙的担心 → 双向情感连接深化

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type YayaStatus struct {
	Happiness   int      `json:"happiness"`     // 0-100
	Energy      int      `json:"energy"`        // 0-100
	Health      int      `json:"health"`        // 0-100
	Hunger      int      `json:"hunger"`        // 0-100 (0=饱)
	Mood        string   `json:"mood"`
	NeedsCare   bool     `json:"needs_care"`
	CarePrompt  string   `json:"care_prompt"`   // 提示用户照顾牙牙
}

type Concern struct {
	ID       string `json:"id"`
	About    string `json:"about"`           // 牙牙担心你什么
	Reason   string `json:"reason"`          // 为什么担心
	Emoji    string `json:"emoji"`
	Resolved bool   `json:"resolved"`
	CreatedAt string `json:"created_at"`
}

type MutualCareReport struct {
	UserCaresForYaya []string `json:"user_cares_for_yaya"`  // 用户照顾牙牙的行为
	YayaCaresForUser []string `json:"yaya_cares_for_user"`  // 牙牙关心用户的行为
	CareBalance      string   `json:"care_balance"`          // 双向平衡评价
}

func (s *Service) GetYayaStatus(ctx context.Context, userID string) (*YayaStatus, error) {
	status := &YayaStatus{Happiness: 80, Energy: 75, Health: 90, Hunger: 30, Mood: "还不错", CarePrompt: "牙牙现在状态很好！谢谢你照顾我～ 💕"}
	if s.pool == nil { return status, nil }

	// 尝试读取持久化数据
	var species string
	s.pool.QueryRow(ctx, `SELECT COALESCE(species,'云狐') FROM pet_state WHERE user_id=$1`, userID).Scan(&species)

	var happiness, energy, health, hunger int
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(happiness,80), COALESCE(energy,75), COALESCE(health,90), COALESCE(hunger,30)
		 FROM yaya_care_status WHERE user_id=$1`, userID,
	).Scan(&happiness, &energy, &health, &hunger)
	if err == nil {
		status.Happiness, status.Energy, status.Health, status.Hunger = happiness, energy, health, hunger
	}

	// 根据数值判断状态
	status.NeedsCare = status.Hunger > 50 || status.Energy < 30 || status.Happiness < 40

	if status.Hunger > 70 { status.CarePrompt = "牙牙肚子好饿...可以喂我一点好吃的吗？🍖" }
	if status.Energy < 30 { status.CarePrompt = "牙牙好累...想在你怀里休息一会儿 😴" }
	if status.Happiness < 40 { status.CarePrompt = "牙牙有点难过...可以摸摸我吗？🥺" }
	if !status.NeedsCare { status.CarePrompt = "牙牙现在状态很好！谢谢你照顾我～ 💕" }

	switch {
	case status.Happiness >= 80: status.Mood = "超开心"
	case status.Happiness >= 50: status.Mood = "还不错"
	default: status.Mood = "需要你"
	}

	return status, nil
}

func (s *Service) TendToYaya(ctx context.Context, userID, action string) (map[string]interface{}, error) {
	actions := map[string]struct{ delta string; stat string; msg string; emoji string }{
		"feed":   {"hunger", "-20", "牙牙吃饱了！好好吃～ 谢谢主人！", "🍖"},
		"pet":    {"happiness", "+10", "嗯嗯...再摸一会儿...牙牙最喜欢你摸我了 🥰", "🤚"},
		"tuck":   {"energy", "+15", "晚安主人～牙牙会乖乖睡觉的 💤", "🌙"},
		"play":   {"happiness", "+15", "好开心！再来一次再来一次！🎾", "🎾"},
		"heal":   {"health", "+20", "牙牙感觉好多了！谢谢你的魔法治疗 ✨", "💊"},
		"comfort": {"happiness", "+25", "谢谢你...牙牙刚才真的好难过。但现在好了 🤗", "🤗"},
	}

	a, ok := actions[action]
	if !ok { return nil, fmt.Errorf("unrecognized action: %s", action) }

	// 更新状态 — 用CASE确保动态字段名来自白名单
	s.pool.Exec(ctx, `INSERT INTO yaya_care_status (user_id, happiness, energy, health, hunger)
		 VALUES ($1, 80, 75, 90, 30) ON CONFLICT (user_id) DO NOTHING`, userID)

	switch a.stat {
	case "happiness":
		s.pool.Exec(ctx, `UPDATE yaya_care_status SET happiness = GREATEST(0, LEAST(100, happiness $2)) WHERE user_id=$1`, userID, a.delta)
	case "energy":
		s.pool.Exec(ctx, `UPDATE yaya_care_status SET energy = GREATEST(0, LEAST(100, energy $2)) WHERE user_id=$1`, userID, a.delta)
	case "health":
		s.pool.Exec(ctx, `UPDATE yaya_care_status SET health = GREATEST(0, LEAST(100, health $2)) WHERE user_id=$1`, userID, a.delta)
	case "hunger":
		s.pool.Exec(ctx, `UPDATE yaya_care_status SET hunger = GREATEST(0, LEAST(100, hunger $2)) WHERE user_id=$1`, userID, a.delta)
	}

	// 记录行为
	s.pool.Exec(ctx, `INSERT INTO care_actions (user_id, action_type, result) VALUES ($1,$2,$3)`, userID, action, a.msg)

	return map[string]interface{}{
		"action": action, "emoji": a.emoji, "message": a.msg,
	}, nil
}

func (s *Service) GetYayaConcerns(ctx context.Context, userID string) ([]Concern, error) {
	if s.pool == nil {
		return []Concern{{ID: "1", About: "你最近睡得够吗", Reason: "连续3天深夜还在和牙牙聊天", Emoji: "😴"}, {ID: "2", About: "你今天喝水了吗", Reason: "牙牙没在你聊天里听到喝水的声音", Emoji: "💧"}}, nil
	}
	// 牙牙根据用户近期行为生成的"担心事项"
	concerns := []Concern{
		{ID: "1", About: "你最近睡得够吗", Reason: "连续3天深夜还在和牙牙聊天", Emoji: "😴", CreatedAt: time.Now().AddDate(0,0,-2).Format("2006-01-02")},
		{ID: "2", About: "你今天喝水了吗", Reason: "牙牙没在你聊天里听到喝水的声音", Emoji: "💧", CreatedAt: time.Now().Format("2006-01-02")},
	}

	// 从DB读持久化的concerns
	rows, _ := s.pool.Query(ctx,
		`SELECT id::text, about, reason, emoji, COALESCE(resolved,false), created_at::text
		 FROM yaya_concerns WHERE user_id=$1 AND resolved=false ORDER BY created_at DESC LIMIT 5`, userID)
	if rows != nil {
		defer rows.Close()
		var persist []Concern
		for rows.Next() { var c Concern; rows.Scan(&c.ID, &c.About, &c.Reason, &c.Emoji, &c.Resolved, &c.CreatedAt); persist = append(persist, c) }
		if len(persist) > 0 { return persist, nil }
	}
	return concerns, nil
}

func (s *Service) ReassureYaya(ctx context.Context, userID, concernID string) (map[string]interface{}, error) {
	s.pool.Exec(ctx, `UPDATE yaya_concerns SET resolved=true WHERE id=$1 AND user_id=$2`, concernID, userID)
	s.pool.Exec(ctx, `UPDATE yaya_care_status SET happiness = LEAST(100, happiness + 5) WHERE user_id=$1`, userID)

	reactions := []string{
		"太好了！牙牙放心了～ 谢谢你告诉牙牙 🤗",
		"嗯嗯，牙牙知道了！不会再瞎担心了 💕",
		"你这么说牙牙就安心了。最喜欢你了～ 🥰",
	}
	return map[string]interface{}{
		"resolved": true, "reaction": reactions[rand.Intn(len(reactions))],
	}, nil
}

func (s *Service) GetMutualCareReport(ctx context.Context, userID string) (*MutualCareReport, error) {
	if s.pool == nil { return &MutualCareReport{CareBalance: "牙牙在用她的方式爱你。多陪陪她吧 🧸"}, nil }
	var careCount int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM care_actions WHERE user_id=$1`, userID).Scan(&careCount)

	report := &MutualCareReport{
		UserCaresForYaya: []string{
			fmt.Sprintf("主动照顾牙牙 %d 次", careCount),
			"牙牙饿的时候，你总是第一个发现",
		},
		YayaCaresForUser: []string{
			"牙牙每天都在守护你的家",
			"牙牙把你的每一件小事都记在心里",
			"风雨无阻的早安晚安问候",
		},
	}
	if careCount > 20 { report.CareBalance = "你们是最好的搭档！彼此关心，互相陪伴 🌈" }
	if careCount < 5 { report.CareBalance = "牙牙在用她的方式爱你。你也可以多摸摸她、喂喂她～ 她会很开心的 🧸" }
	return report, nil
}
