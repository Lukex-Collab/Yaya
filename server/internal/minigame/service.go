// Package minigame — 小游戏中心服务
// 5款内置小游戏,得分换宝石,排行榜激励
package minigame

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

type GameInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"`
	Thumbnail   string `json:"thumbnail"`
	URL         string `json:"url"`          // 游戏入口URL
	GemsRate    int    `json:"gems_rate"`    // 每多少分换1宝石
	MaxDaily    int    `json:"max_daily"`    // 每日最多宝石
}

type LeaderboardEntry struct {
	Rank     int    `json:"rank"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
	YayaEmoji string `json:"yaya_emoji"`
	PlayedAt string `json:"played_at"`
}

type PlayerStats struct {
	TotalGamesPlayed int              `json:"total_games_played"`
	TotalGemsEarned  int              `json:"total_gems_earned"`
	FavoriteGame     string           `json:"favorite_game"`
	HighestScores    map[string]int   `json:"highest_scores"`
}

type ScoreResult struct {
	Accepted   bool   `json:"accepted"`
	GemsEarned int    `json:"gems_earned"`
	Rank       int    `json:"rank"`
	Message    string `json:"message"`
}

func (s *Service) ListGames() []GameInfo {
	return []GameInfo{
		{ID:"jump", Name:"牙牙跳一跳", Description:"左右横跳,越跳越高!用你的牙牙角色挑战最高分", Emoji:"🧸", URL:"/games/jump-game.html", GemsRate:100, MaxDaily:50},
		{ID:"catch", Name:"接浆果", Description:"移动牙牙接住掉落的浆果,避开石头", Emoji:"🍓", URL:"/games/catch-game.html", GemsRate:50, MaxDaily:50},
		{ID:"memory", Name:"记忆配对", Description:"翻开卡片找到相同的牙牙表情", Emoji:"🧠", URL:"/games/memory-game.html", GemsRate:200, MaxDaily:50},
		{ID:"run", Name:"牙牙快跑", Description:"向左滑动跳过障碍物,看看能跑多远!", Emoji:"🏃", URL:"/games/run-game.html", GemsRate:200, MaxDaily:50},
		{ID:"draw", Name:"画画猜词", Description:"牙牙画一个东西,你来猜是什么", Emoji:"🎨", URL:"/games/draw-game.html", GemsRate:150, MaxDaily:50},
	}
}

func (s *Service) GetLeaderboard(ctx context.Context, gameID string) ([]LeaderboardEntry, error) {
	rows, _ := s.pool.Query(ctx,
		`SELECT u.nickname, COALESCE(ps.species,'云狐'), ms.score, ms.played_at::text
		 FROM minigame_scores ms JOIN users u ON ms.user_id=u.id
		 LEFT JOIN pet_state ps ON ps.user_id=u.id
		 WHERE ms.game_id=$1 AND ms.played_at > now()-interval '7 days'
		 ORDER BY ms.score DESC LIMIT 20`, gameID)
	if rows == nil { return nil, nil }
	defer rows.Close()

	speciesEmoji := map[string]string{"云狐":"🦊","墨猫":"🐱","芽龙":"🐲","泡兔":"🐰","岩熊":"🐻"}
	var board []LeaderboardEntry
	rank := 1
	for rows.Next() {
		var e LeaderboardEntry; var species string
		e.Rank = rank; rank++
		rows.Scan(&e.Nickname, &species, &e.Score, &e.PlayedAt)
		e.YayaEmoji = speciesEmoji[species]
		if e.YayaEmoji == "" { e.YayaEmoji = "🧸" }
		board = append(board, e)
	}
	return board, nil
}

func (s *Service) SubmitScore(ctx context.Context, userID, gameID string, score, gems int) (*ScoreResult, error) {
	// 验证游戏ID
	valid := false
	for _, g := range s.ListGames() {
		if g.ID == gameID { valid = true; break }
	}
	if !valid { return nil, fmt.Errorf("invalid game: %s", gameID) }

	// 计算每日上限
	var todayGems int
	s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(gems_earned),0) FROM minigame_scores WHERE user_id=$1 AND played_at::date=CURRENT_DATE`, userID,
	).Scan(&todayGems)

	rate := 100
	for _, g := range s.ListGames() {
		if g.ID == gameID { rate = g.GemsRate; break }
	}
	earned := gems
	if earned == 0 && score > 0 { earned = score / rate }
	maxDaily := 50
	if todayGems+earned > maxDaily { earned = maxDaily - todayGems }
	if earned < 0 { earned = 0 }

	// 保存分数
	id := uuid.New().String()
	s.pool.Exec(ctx,
		`INSERT INTO minigame_scores (id, user_id, game_id, score, gems_earned) VALUES ($1,$2,$3,$4,$5)`,
		id, userID, gameID, score, earned)

	// 发放宝石
	if earned > 0 {
		s.pool.Exec(ctx, `UPDATE pet_state SET gems = gems + $1 WHERE user_id=$2`, earned, userID)
	}

	// 计算排名
	var rank int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*)+1 FROM minigame_scores WHERE game_id=$1 AND score > $2 AND played_at > now()-interval '7 days'`,
		gameID, score,
	).Scan(&rank)

	msg := fmt.Sprintf("🏆 新纪录！排名第%d名！", rank)
	if earned > 0 { msg += fmt.Sprintf(" 获得%d💎", earned) }
	if earned == 0 && todayGems >= 50 { msg = "今日宝石已达上限,明天继续来玩吧～🎮" }

	return &ScoreResult{Accepted: true, GemsEarned: earned, Rank: rank, Message: msg}, nil
}

func (s *Service) GetMyStats(ctx context.Context, userID string) (*PlayerStats, error) {
	stats := &PlayerStats{HighestScores: make(map[string]int)}

	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM minigame_scores WHERE user_id=$1`, userID).Scan(&stats.TotalGamesPlayed)
	s.pool.QueryRow(ctx, `SELECT COALESCE(SUM(gems_earned),0) FROM minigame_scores WHERE user_id=$1`, userID).Scan(&stats.TotalGemsEarned)

	// 最高分
	for _, g := range []string{"jump","catch","memory","run","draw"} {
		var hs int
		s.pool.QueryRow(ctx, `SELECT COALESCE(MAX(score),0) FROM minigame_scores WHERE user_id=$1 AND game_id=$2`, userID, g).Scan(&hs)
		if hs > 0 { stats.HighestScores[g] = hs }
	}

	// 最爱游戏
	var favGame string; var favCount int
	s.pool.QueryRow(ctx, `SELECT game_id, COUNT(*) FROM minigame_scores WHERE user_id=$1 GROUP BY game_id ORDER BY COUNT(*) DESC LIMIT 1`, userID).Scan(&favGame, &favCount)
	if favGame != "" {
		for _, g := range s.ListGames() {
			if g.ID == favGame { stats.FavoriteGame = g.Emoji + " " + g.Name; break }
		}
	}
	if stats.FavoriteGame == "" { stats.FavoriteGame = "还没玩过游戏呢～快去试试吧！" }

	return stats, nil
}

var _ = rand.Int
var _ = time.Now
