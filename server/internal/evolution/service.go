// Package evolution — 宠物进化系统
// 5级进化：幼年期→成长期→成熟期→觉醒期→神化期
// 每次进化外观变化、解锁新能力
package evolution

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service {
	pool.Exec(context.Background(),
		`CREATE TABLE IF NOT EXISTS pet_evolution_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id),
			from_stage VARCHAR(32), to_stage VARCHAR(32),
			created_at TIMESTAMPTZ DEFAULT now())`)
	return &Service{pool: pool}
}

// Stage 进化阶段
type Stage struct {
	Level      int    `json:"level"`
	Name       string `json:"name"`
	MinEXP     int    `json:"min_exp"`
	NewAbility string `json:"new_ability"`
	EmojiBonus string `json:"emoji_bonus"`
}

// 5级进化路线
var EvolutionStages = []Stage{
	{Level:1, Name:"幼年期", MinEXP:0, NewAbility:"基础对话", EmojiBonus:"🐣"},
	{Level:2, Name:"成长期", MinEXP:100, NewAbility:"解锁语音对话", EmojiBonus:"🦊"},
	{Level:3, Name:"成熟期", MinEXP:500, NewAbility:"解锁专属技能", EmojiBonus:"✨"},
	{Level:4, Name:"觉醒期", MinEXP:2000, NewAbility:"外观进化发光", EmojiBonus:"💫"},
	{Level:5, Name:"神化期", MinEXP:8000, NewAbility:"解锁云端浮岛", EmojiBonus:"👑"},
}

// GetCurrentStage 获取当前进化阶段
func (s *Service) GetCurrentStage(ctx context.Context, userID string) (*Stage, error) {
	var exp int
	s.pool.QueryRow(ctx,
		`SELECT COALESCE(exp,0) FROM pet_state WHERE user_id=$1`, userID,
	).Scan(&exp)

	for i := len(EvolutionStages) - 1; i >= 0; i-- {
		if exp >= EvolutionStages[i].MinEXP {
			return &EvolutionStages[i], nil
		}
	}
	return &EvolutionStages[0], nil
}

// AddEXP 添加经验值并检查进化
func (s *Service) AddEXP(ctx context.Context, userID string, amount int) (bool, *Stage, error) {
	var oldExp int
	s.pool.QueryRow(ctx, `SELECT COALESCE(exp,0) FROM pet_state WHERE user_id=$1`, userID).Scan(&oldExp)
	oldStage := s.getStageForExp(oldExp)

	newExp := oldExp + amount
	s.pool.Exec(ctx,
		`INSERT INTO pet_state (user_id, exp) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET exp=pet_state.exp+$2, updated_at=now()`,
		userID, amount,
	)

	newStage := s.getStageForExp(newExp)
	if newStage.Level > oldStage.Level {
		// 记录进化历史
		s.pool.Exec(ctx,
			`INSERT INTO pet_evolution_history (user_id, from_stage, to_stage) VALUES ($1,$2,$3)`,
			userID, oldStage.Name, newStage.Name,
		)
		// 更新level
		s.pool.Exec(ctx, `UPDATE pet_state SET level=$1 WHERE user_id=$2`, newStage.Level, userID)
		slog.Info("pet evolved", "user", userID, "from", oldStage.Name, "to", newStage.Name)
		return true, newStage, nil
	}

	return false, newStage, nil
}

func (s *Service) getStageForExp(exp int) *Stage {
	for i := len(EvolutionStages) - 1; i >= 0; i-- {
		if exp >= EvolutionStages[i].MinEXP {
			return &EvolutionStages[i]
		}
	}
	return &EvolutionStages[0]
}

// 各行为获得的经验值
func GetActivityEXP(activity string) int {
	switch activity {
	case "chat": return 5
	case "explore": return 15
	case "journal": return 10
	case "checkin": return 5
	case "gratitude": return 8
	case "friend": return 10
	case "visit": return 12
	case "feed": return 3
	default: return 2
	}
}
