// Package wellness — AI陪伴心理慰藉核心模块
// 每日心情签到 + 感恩日记 + AI成长报告 + 主动关怀鼓励
package wellness

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

type Service struct {
	pool   *pgxpool.Pool
	client *openai.Client
}

func NewService(pool *pgxpool.Pool, client *openai.Client) *Service {
	return &Service{pool: pool, client: client}
}

// ─── 每日心情签到 ───

type MoodCheckin struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
	Score  int    `json:"score"` // 1-5
	Note   string `json:"note"`
	AiReply string `json:"ai_reply"`
	Date   string `json:"date"`
}

func (s *Service) Checkin(ctx context.Context, userID string, score int, note string) (*MoodCheckin, error) {
	if score < 1 { score = 1 }
	if score > 5 { score = 5 }

	today := time.Now().Format("2006-01-02")

	// 今天是否已签到
	var existingID string
	if err := s.pool.QueryRow(ctx,
		`SELECT id FROM mood_checkins WHERE user_id=$1 AND date=$2`, userID, today,
	).Scan(&existingID); err == nil && existingID != "" {
		return nil, fmt.Errorf("今天已经签到过了")
	}

	// AI生成个性化回应
	aiReply := s.generateCheckinReply(ctx, score, note)

	// 写入
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO mood_checkins (user_id, score, note, ai_reply, date) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		userID, score, note, aiReply, today,
	).Scan(&id)
	if err != nil {
		return nil, err
	}

	// 如果score<=2，自动触发关怀推送
	if score <= 2 {
		s.CareNudge(ctx, userID, score)
	}

	return &MoodCheckin{ID: id, UserID: userID, Score: score, Note: note, AiReply: aiReply, Date: today}, nil
}

func (s *Service) generateCheckinReply(ctx context.Context, score int, note string) string {
	if s.client == nil {
		return defaultReplies[score]
	}
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(fmt.Sprintf("用户今天心情评分%d分(1-5)。如果有备注:'%s'。用牙牙的口吻(宠物伙伴,温暖治愈)回复一句话,15字以内。不要长篇。", score, note)),
		}),
		MaxTokens: openai.F(int64(60)), Temperature: openai.F(0.9),
	})
	if err != nil || len(resp.Choices) == 0 { return defaultReplies[score] }
	return resp.Choices[0].Message.Content
}

var defaultReplies = map[int]string{
	1: "我在呢。你可以什么都不用说，我陪你。",
	2: "今天辛苦了。过来靠一会儿。",
	3: "不管怎样，今天也是属于你的一天！",
	4: "不错的一天！我为你开心~",
	5: "哇！太棒了！今天绝对值得记住！🎉",
}

func (s *Service) GetTodayCheckin(ctx context.Context, userID string) (*MoodCheckin, error) {
	today := time.Now().Format("2006-01-02")
	var m MoodCheckin
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, score, COALESCE(note,''), COALESCE(ai_reply,''), date
		 FROM mood_checkins WHERE user_id=$1 AND date=$2`, userID, today,
	).Scan(&m.ID, &m.UserID, &m.Score, &m.Note, &m.AiReply, &m.Date)
	return &m, err
}

func (s *Service) GetMoodHistory(ctx context.Context, userID string, days int) ([]MoodCheckin, error) {
	if days < 1 || days > 90 { days = 30 }
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, score, COALESCE(note,''), COALESCE(ai_reply,''), date
		 FROM mood_checkins WHERE user_id=$1 ORDER BY date DESC LIMIT $2`, userID, days)
	if err != nil { return nil, err }
	defer rows.Close()
	var list []MoodCheckin
	for rows.Next() {
		var m MoodCheckin
		rows.Scan(&m.ID, &m.UserID, &m.Score, &m.Note, &m.AiReply, &m.Date)
		list = append(list, m)
	}
	return list, nil
}

// ─── 感恩日记 ───

type Gratitude struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
	Content string `json:"content"`
	Date   string `json:"date"`
}

func (s *Service) AddGratitude(ctx context.Context, userID, content string) (*Gratitude, error) {
	today := time.Now().Format("2006-01-02")
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO gratitudes (user_id, content, date) VALUES ($1,$2,$3) RETURNING id`, userID, content, today,
	).Scan(&id)
	return &Gratitude{ID:id,UserID:userID,Content:content,Date:today}, err
}

func (s *Service) GetGratitudes(ctx context.Context, userID string, limit int) ([]Gratitude, error) {
	if limit < 1 || limit > 50 { limit = 20 }
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, content, date FROM gratitudes WHERE user_id=$1 ORDER BY date DESC LIMIT $2`, userID, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var list []Gratitude
	for rows.Next() {
		var g Gratitude; rows.Scan(&g.ID, &g.UserID, &g.Content, &g.Date)
		list = append(list, g)
	}
	return list, nil
}

// ─── AI成长报告 ───

type GrowthReport struct {
	Period      string `json:"period"`
	TotalDays   int `json:"total_days"`
	AvgMood     float64 `json:"avg_mood"`
	TotalJournals int `json:"total_journals"`
	TotalMessages int `json:"total_messages"`
	NewMemories   int `json:"new_memories"`
	NewAchievements int `json:"new_achievements"`
	Summary     string `json:"summary"` // AI生成的个性化总结
	GeneratedAt string `json:"generated_at"`
}

func (s *Service) GenerateReport(ctx context.Context, userID, period string) (*GrowthReport, error) {
	days := 7
	if period == "month" { days = 30 } else if period == "quarter" { days = 90 }

	var totalDays, totalJournals, totalMessages, newMemories, newAchievements int
	var avgMood float64

	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM mood_checkins WHERE user_id=$1 AND date >= now()-make_interval(days:=$2)`, userID, days).Scan(&totalDays)
	s.pool.QueryRow(ctx, `SELECT COALESCE(AVG(score),3.0) FROM mood_checkins WHERE user_id=$1 AND date >= now()-make_interval(days:=$2)`, userID, days).Scan(&avgMood)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE user_id=$1 AND created_at >= now()-make_interval(days:=$2)`, userID, days).Scan(&totalJournals)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id=c.id WHERE c.user_id=$1 AND m.created_at >= now()-make_interval(days:=$2)`, userID, days).Scan(&totalMessages)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM memories WHERE user_id=$1 AND created_at >= now()-make_interval(days:=$2)`, userID, days).Scan(&newMemories)

	// AI生成总结
	summary := s.generateSummary(ctx, totalDays, int(avgMood), totalJournals, totalMessages, newMemories, period)

	return &GrowthReport{
		Period: period, TotalDays: totalDays, AvgMood: avgMood,
		TotalJournals: totalJournals, TotalMessages: totalMessages,
		NewMemories: newMemories, NewAchievements: newAchievements,
		Summary: summary, GeneratedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *Service) generateSummary(ctx context.Context, days, avgMood, journals, messages, memories int, period string) string {
	if s.client == nil {
		return fmt.Sprintf("这%d天里，你写了%d篇日记，和牙牙聊了%d次天。平均心情%d分。继续加油！", days, journals, messages, avgMood)
	}
	prompt := fmt.Sprintf("你是牙牙,一只AI宠物。主人这%d天的数据:平均心情%d/5,写了%d篇日记,聊了%d次天,%d条新记忆。用温暖口语化的方式,3句以内,总结并能鼓励主人。称呼ta为'你'。", days, avgMood, journals, messages, memories)
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{openai.UserMessage(prompt)}),
		MaxTokens: openai.F(int64(120)), Temperature: openai.F(0.8),
	})
	if err != nil || len(resp.Choices) == 0 {
		return "这些天有你陪伴真好。每一天都值得记住。"
	}
	return resp.Choices[0].Message.Content
}

// ─── 主动关怀鼓励 ───

func (s *Service) CareNudge(ctx context.Context, userID string, score int) {
	msgs := map[int]string{
		1: "牙牙注意到你今天心情不太好。不用勉强自己。过来坐一会儿，我在这里。",
		2: "今天好像不太顺。没关系，你不是一个人。",
	}
	content := msgs[score]
	if content == "" { content = "牙牙在想你。今天过得怎么样？" }

	s.pool.Exec(ctx,
		`INSERT INTO push_messages (id, user_id, msg_type, title, content) VALUES (gen_random_uuid(),$1,'care','牙牙的关心',$2)`,
		userID, content,
	)
}

func (s *Service) GetCareStatus(ctx context.Context, userID string) (map[string]interface{}, error) {
	// 计算连续签到天数
	var streak int
	s.pool.QueryRow(ctx,
		`WITH dates AS (
			SELECT date, ROW_NUMBER() OVER (ORDER BY date DESC) as rn
			FROM mood_checkins WHERE user_id=$1 ORDER BY date DESC
		) SELECT COUNT(*) FROM dates WHERE date = CURRENT_DATE - (rn-1)`, userID,
	).Scan(&streak)

	var todayScore *int
	var score int
	if err := s.pool.QueryRow(ctx, `SELECT score FROM mood_checkins WHERE user_id=$1 AND date=CURRENT_DATE`, userID).Scan(&score); err == nil {
		todayScore = &score
	}

	return map[string]interface{}{
		"streak": streak,
		"today_checked_in": todayScore != nil,
		"today_score": todayScore,
	}, nil
}
