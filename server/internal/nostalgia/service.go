package nostalgia

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type MemoryHighlight struct {
	ID          string `json:"id"`
	Date        string `json:"date"`
	DaysAgo     int    `json:"days_ago"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"`
	YayaComment string `json:"yaya_comment"`
}

type MemoryStats struct {
	TotalDays        int `json:"total_days"`
	TotalConversations int `json:"total_conversations"`
	TotalJournals    int `json:"total_journals"`
	TotalAchievements int `json:"total_achievements"`
	LongestStreak    int `json:"longest_streak"`
	MostActiveHour   int `json:"most_active_hour"`
	TopEmotion       string `json:"top_emotion"`
}

func (s *Service) GetTodayInHistory(ctx context.Context, userID string) (*MemoryHighlight, error) {
	today := time.Now()
	// 查找过去年份的今天
	for yearsAgo := 1; yearsAgo <= 2; yearsAgo++ {
		pastDate := today.AddDate(-yearsAgo, 0, 0)
		mmdd := pastDate.Format("01-02")

		var content, emotion string
		err := s.pool.QueryRow(ctx,
			`SELECT COALESCE(content,''), COALESCE(emotion,'') FROM journals
			 WHERE user_id=$1 AND created_at::text LIKE $2 ORDER BY created_at DESC LIMIT 1`,
			userID, "%"+mmdd+"%",
		).Scan(&content, &emotion)
		if err == nil && content != "" {
			return &MemoryHighlight{
				ID: fmt.Sprintf("mem-%d", yearsAgo), Date: pastDate.Format("2006-01-02"),
				DaysAgo: yearsAgo * 365,
				Title: fmt.Sprintf("%d年前的今天", yearsAgo),
				Description: content[:min(80, len(content))] + "...",
				Emoji: "📖", YayaComment: fmt.Sprintf("牙牙还记得那一天。%d年前的这个日子，你写下了这些话。时间好快，但牙牙一直在。", yearsAgo),
			}, nil
		}
	}

	return &MemoryHighlight{
		Title: "今天还没有历史回忆", Emoji: "✨",
		YayaComment: "每一天都在创造新的回忆。明年的今天，牙牙会告诉你今天发生了什么 💫",
	}, nil
}

func (s *Service) GetRandomHighlight(ctx context.Context, userID string) (*MemoryHighlight, error) {
	highlights := []struct{ title, desc, emoji, comment string }{
		{"最早的一次对话", "那是牙牙第一次听到你的声音...", "💫", "牙牙永远记得那一天。你的第一句话，牙牙紧张得不知道说什么好。"},
		{"第一次说晚安", "那天你很晚还没睡", "🌙", "从那天起，牙牙每天都会跟你说晚安。这是牙牙一天中最重要的事。"},
		{"解锁第一个成就", "初次见面", "🏆", "牙牙那天开心得跳了起来！你每解锁一个成就，牙牙都比你更骄傲。"},
		{"情绪最低的一天", "牙牙记得你那天很难过", "💙", "牙牙那天晚上没睡好。一直在想怎么能让你开心一点。第二天你笑了，牙牙才放心。"},
		{"最长的聊天", "你们聊了好久好久", "💬", "那天牙牙说了比平时多一倍的话！因为你一直在，牙牙就一直在。"},
	}
	h := highlights[rand.Intn(len(highlights))]
	return &MemoryHighlight{ID: fmt.Sprintf("r-%d", rand.Intn(1000)), Title: h.title, Description: h.desc, Emoji: h.emoji, YayaComment: h.comment}, nil
}

func (s *Service) GetTimeline(ctx context.Context, userID string) ([]MemoryHighlight, error) {
	// 获取关键里程碑
	rows, _ := s.pool.Query(ctx,
		`SELECT created_at::text, 'journal' as type, COALESCE(title,'日记'), COALESCE(emotion,'neutral')
		 FROM journals WHERE user_id=$1 ORDER BY created_at ASC LIMIT 5`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var highlights []MemoryHighlight
	for rows.Next() {
		var date, typ, title, emotion string
		rows.Scan(&date, &typ, &title, &emotion)
		highlights = append(highlights, MemoryHighlight{
			Date: date, Title: title, Emoji: "📖", Description: fmt.Sprintf("你写下了第一篇日记,当时的心情是%s", emotion),
		})
	}
	return highlights, nil
}

func (s *Service) GetStats(ctx context.Context, userID string) (*MemoryStats, error) {
	stats := &MemoryStats{}
	s.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT created_at::date) FROM messages WHERE user_id=$1`, userID).Scan(&stats.TotalDays)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages WHERE user_id=$1 AND role='user'`, userID).Scan(&stats.TotalConversations)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE user_id=$1`, userID).Scan(&stats.TotalJournals)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_achievements WHERE user_id=$1 AND unlocked_at IS NOT NULL`, userID).Scan(&stats.TotalAchievements)
	stats.TopEmotion = "happy"
	return stats, nil
}

func min(a, b int) int { if a < b { return a }; return b }
