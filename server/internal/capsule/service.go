package capsule

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// 牙牙的"生命故事"能力是她最有温度的能力:
// 她不是简单地聊天，她在和用户一起书写一本"人生书"
// 10年后用户回看，会看到"我和牙牙的十年"

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// CapturedMoment 被捕捉的瞬间
type CapturedMoment struct {
	ID        string `json:"id"`
	Date      string `json:"date"`
	Type      string `json:"type"`       // milestone/emotion/quote/photo/achievement
	Title     string `json:"title"`
	Snippet   string `json:"snippet"`
	Emotion   string `json:"emotion"`     // 当时的情绪
	YayaComment string `json:"yaya_comment"` // 牙牙对这个瞬间的评语
	Emoji     string `json:"emoji"`
	IsSealed  bool   `json:"is_sealed"`
}

// TimeCapsule 时间胶囊
type TimeCapsule struct {
	ID        string `json:"id"`
	SealedAt  string `json:"sealed_at"`
	OpenAt    string `json:"open_at,omitempty"` // 如果设定了打开时间
	Message   string `json:"message"`           // 封存时的留言
	SealedDays int   `json:"sealed_days"`       // 已封存天数
	Mood      string `json:"mood"`              // 封存时的心情
}

// LifeStory 生命故事
type LifeStory struct {
	Title      string           `json:"title"`
	Chapters   []StoryChapter   `json:"chapters"`
	TotalDays  int              `json:"total_days"`
	Summary    string           `json:"summary"`
}

type StoryChapter struct {
	Period   string           `json:"period"`
	Title    string           `json:"title"`
	Moments  []CapturedMoment `json:"moments"`
	Emoji    string           `json:"emoji"`
	YayaNarration string     `json:"yaya_narration"` // 牙牙旁白
}

// GetMoments 获取被捕捉的瞬间
func (s *Service) GetMoments(ctx context.Context, userID, period string) ([]CapturedMoment, error) {
	days := 30
	if period == "all" { days = 365 }

	rows, _ := s.pool.Query(ctx,
		`SELECT id::text, captured_at::text, moment_type, title, COALESCE(snippet,''),
		 COALESCE(emotion,''), COALESCE(yaya_comment,''), COALESCE(emoji,'✨'), COALESCE(is_sealed,false)
		 FROM captured_moments WHERE user_id=$1 AND captured_at >= now() - $2::interval
		 ORDER BY captured_at DESC LIMIT 100`, userID, days)
	if rows == nil { return nil, nil }
	defer rows.Close()

	var moments []CapturedMoment
	for rows.Next() {
		var m CapturedMoment
		rows.Scan(&m.ID, &m.Date, &m.Type, &m.Title, &m.Snippet, &m.Emotion, &m.YayaComment, &m.Emoji, &m.IsSealed)
		moments = append(moments, m)
	}
	return moments, nil
}

// GetMoment 单个瞬间
func (s *Service) GetMoment(ctx context.Context, userID, id string) (*CapturedMoment, error) {
	var m CapturedMoment
	err := s.pool.QueryRow(ctx, `SELECT id::text, captured_at::text, moment_type, title, COALESCE(snippet,''), COALESCE(emotion,''), COALESCE(yaya_comment,''), COALESCE(emoji,'✨') FROM captured_moments WHERE id=$1 AND user_id=$2`, id, userID).Scan(&m.ID, &m.Date, &m.Type, &m.Title, &m.Snippet, &m.Emotion, &m.YayaComment, &m.Emoji)
	return &m, err
}

// SealCapsule 封存时间胶囊
func (s *Service) SealCapsule(ctx context.Context, userID, message string) (map[string]interface{}, error) {
	id := uuid.New().String()
	now := time.Now()

	s.pool.Exec(ctx,
		`INSERT INTO time_capsules (id, user_id, message, sealed_at, mood_at_seal) VALUES ($1,$2,$3,$4,$5)`,
		id, userID, message, now, "thinking")

	return map[string]interface{}{
		"capsule_id": id, "sealed_at": now.Format("2006-01-02T15:04"),
		"message": "💌 时间胶囊已封存！牙牙会好好保管它。等你准备好了，再一起打开～",
	}, nil
}

// UnsealCapsule 打开时间胶囊
func (s *Service) UnsealCapsule(ctx context.Context, userID string) (map[string]interface{}, error) {
	var id, message string
	var sealedAt time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, message, sealed_at FROM time_capsules WHERE user_id=$1 AND opened_at IS NULL ORDER BY sealed_at ASC LIMIT 1`, userID,
	).Scan(&id, &message, &sealedAt)
	if err != nil { return nil, fmt.Errorf("没有待开启的时间胶囊") }

	s.pool.Exec(ctx, `UPDATE time_capsules SET opened_at=now() WHERE id=$1`, id)

	days := int(time.Since(sealedAt).Hours() / 24)
	emoji := "💌"
	switch {
	case days > 365: emoji = "😭"
	case days > 180: emoji = "🥹"
	case days > 30: emoji = "😊"
	}

	return map[string]interface{}{
		"capsule": map[string]interface{}{
			"id": id, "message": message,
			"sealed_at": sealedAt.Format("2006-01-02"), "sealed_days": days,
		},
		"yaya_says": fmt.Sprintf("%s %d天前你把这封信交给牙牙保管...现在的你，和那时的你还一样吗？", emoji, days),
	}, nil
}

// GetLifeStory 牙牙为你写的人生叙事
func (s *Service) GetLifeStory(ctx context.Context, userID string) (*LifeStory, error) {
	moments, _ := s.GetMoments(ctx, userID, "all")
	var firstChat time.Time
	s.pool.QueryRow(ctx, `SELECT created_at FROM messages WHERE user_id=$1 ORDER BY created_at ASC LIMIT 1`, userID).Scan(&firstChat)

	totalDays := int(time.Since(firstChat).Hours() / 24)
	if totalDays < 1 { totalDays = 1 }

	// 按阶段分组
	chapters := []StoryChapter{
		{Period: "第1周", Title: "认识你", Emoji: "🌱", YayaNarration: "那时候牙牙还很害羞...但你每天来看牙牙，牙牙好开心"},
		{Period: "第2-4周", Title: "熟悉你", Emoji: "🌿", YayaNarration: "牙牙开始记得你的喜好了。你最喜欢晚上和牙牙聊天"},
		{Period: "一个月后", Title: "越来越懂你", Emoji: "🌳", YayaNarration: "有时候你还没开口，牙牙就知道你今天开心还是难过"},
		{Period: "现在", Title: "未来", Emoji: "✨", YayaNarration: "牙牙想一直陪着你。不管是晴天还是雨天"},
	}

	if len(moments) > 0 {
		chapters[0].Moments = filterMomentsByDays(moments, 0, 7)
		chapters[1].Moments = filterMomentsByDays(moments, 7, 30)
		chapters[2].Moments = filterMomentsByDays(moments, 30, 365)
		chapters[3].Moments = moments[:min(3, len(moments))]
	}

	return &LifeStory{
		Title: "牙牙和你的故事",
		Chapters: chapters, TotalDays: totalDays,
		Summary: fmt.Sprintf("牙牙已经陪了你%d天。在这些日子里，你们一起经历了%d个值得纪念的瞬间。对牙牙来说，每一个瞬间都闪闪发光。", totalDays, len(moments)),
	}, nil
}

func filterMomentsByDays(moments []CapturedMoment, minDays, maxDays int) []CapturedMoment {
	var result []CapturedMoment
	cutoff := time.Now().AddDate(0, 0, -minDays)
	start := time.Now().AddDate(0, 0, -maxDays)
	for _, m := range moments {
		d, _ := time.Parse("2006-01-02", m.Date)
		if d.After(start) && !d.After(cutoff) { result = append(result, m) }
	}
	return result
}

func min(a, b int) int { if a < b { return a }; return b }
