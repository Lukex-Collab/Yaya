package emotion

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type TrendPoint struct {
	Date   string  `json:"date"`
	Emotion string `json:"emotion"`
	Emoji  string  `json:"emoji"`
	Score  float64 `json:"score"`
}

type EmotionReport struct {
	Period        string       `json:"period"`
	DominantMood  string       `json:"dominant_mood"`
	MoodCounts    map[string]int `json:"mood_counts"`
	Trend         []TrendPoint `json:"trend"`
	Insights      []string     `json:"insights"`
	GeneratedAt   string       `json:"generated_at"`
}

type RescueAction struct {
	Type        string `json:"type"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"`
}

func (s *Service) GetTrend(ctx context.Context, userID, period string) ([]TrendPoint, error) {
	days := 7
	if period == "month" { days = 30 } else if period == "quarter" { days = 90 }

	rows, err := s.pool.Query(ctx,
		`SELECT created_at::text, COALESCE(emotion,'neutral')
		 FROM journals WHERE user_id=$1 AND created_at >= now() - interval '1 day' * $2
		 ORDER BY created_at ASC`, userID, days,
	)
	if err != nil { return nil, err }
	defer rows.Close()

	emojis := map[string]string{"happy":"😊","sad":"😢","anxious":"😰","angry":"😤","calm":"😌","excited":"🎉","tired":"😴","neutral":"💭"}
	scores := map[string]float64{"happy":1,"excited":0.9,"calm":0.7,"neutral":0.5,"anxious":0.3,"sad":0.2,"tired":0.1,"angry":0.1}

	var points []TrendPoint
	for rows.Next() {
		var date, emotion string
		rows.Scan(&date, &emotion)
		points = append(points, TrendPoint{
			Date: date, Emotion: emotion,
			Emoji: emojis[emotion], Score: scores[emotion],
		})
	}
	return points, nil
}

func (s *Service) GetMonthlyReport(ctx context.Context, userID string) (*EmotionReport, error) {
	points, _ := s.GetTrend(ctx, userID, "month")

	moodCounts := map[string]int{"happy":0,"sad":0,"anxious":0,"calm":0,"excited":0,"tired":0}
	for _, p := range points { moodCounts[p.Emotion]++ }

	dominant, maxCount := "neutral", 0
	for mood, count := range moodCounts {
		if count > maxCount { dominant, maxCount = mood, count }
	}

	insights := generateInsights(moodCounts, points)
	return &EmotionReport{
		Period: "month", DominantMood: dominant,
		MoodCounts: moodCounts, Trend: points,
		Insights: insights, GeneratedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *Service) GetInsights(ctx context.Context, userID string) ([]string, error) {
	points, _ := s.GetTrend(ctx, userID, "month")
	moodCounts := map[string]int{}
	for _, p := range points { moodCounts[p.Emotion]++ }
	return generateInsights(moodCounts, points), nil
}

func (s *Service) EmotionRescue(ctx context.Context, userID, action string) (map[string]interface{}, error) {
	rescueActions := map[string]RescueAction{
		"hug":       {"hug","牙牙抱抱","牙牙紧紧地抱着你，一切都会好的 🤗","🤗"},
		"breathe":   {"breathe","深呼吸引导","跟着牙牙一起深呼吸：吸气4秒...屏住4秒...呼气6秒... 🌬️","🌬️"},
		"whitenoise":{"whitenoise","白噪音","雨声淅淅沥沥，你什么都不用想，牙牙陪着你 🌧️","🌧️"},
		"vent":      {"vent","倾诉模式","牙牙在听，你想说什么都可以，不说也可以 💬","💬"},
		"gratitude": {"gratitude","感恩三件事","今天有什么开心的小事？写下来会感觉好很多 ✨","✨"},
	}
	a, ok := rescueActions[action]
	if !ok { a = rescueActions["hug"] }
	return map[string]interface{}{"action": a, "message": a.Description}, nil
}

func generateInsights(counts map[string]int, points []TrendPoint) []string {
	var insights []string
	total := 0
	for _, c := range counts { total += c }
	if total == 0 { return []string{"还没有足够的情绪数据，和牙牙多聊聊吧 🧸"} }

	happyPct := float64(counts["happy"]+counts["excited"]) / float64(total)
	sadPct := float64(counts["sad"]+counts["anxious"]+counts["tired"]) / float64(total)

	if happyPct > 0.6 { insights = append(insights, "✨ 这个月整体情绪很好！继续保持～") }
	if sadPct > 0.4 { insights = append(insights, "💙 这个月有些低落的日子，没关系，牙牙一直在") }
	if counts["happy"] > 0 && counts["anxious"] > 0 {
		insights = append(insights, "📊 情绪有起有落很正常，接受每一种心情")
	}
	insights = append(insights, "🧸 和牙牙聊天最多的那天，也是你情绪最好的那天")
	return insights
}


