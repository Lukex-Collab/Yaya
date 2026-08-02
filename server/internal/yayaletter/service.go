// Package yayaletter — 牙牙来信 (每周AI手写信)
// "每周一, 牙牙会用她歪歪扭扭的字给你写一封信"
//
// 这封信不是冷冰冰的"周报"，是牙牙用她的视角写的：
// "这周你笑了12次, 哭了2次。哭的那两天牙牙好心疼..."
// "周三你和闺蜜聊到凌晨, 牙牙在旁边安静地听着"
// "周五你解锁了新成就! 牙牙骄傲得在玩具堆里滚了一圈"
//
// 产品逻辑:
//   每周一早上推送 → 触发用户回访
//   信的内容极度个性化 → 用户截图分享朋友圈 → 获客
//   日积月累 → 一年52封信 → "和牙牙的一年"

package yayaletter

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

type WeeklyLetter struct {
	ID         string `json:"id"`
	Week       string `json:"week"`       // "2026年第31周"
	Title      string `json:"title"`
	Content    string `json:"content"`     // 牙牙手写信正文
	MoodStats  map[string]int `json:"mood_stats"`
	Highlights []string `json:"highlights"`
	YayaPS     string `json:"yaya_ps"`     // 牙牙的附言
	ShareImageURL string `json:"share_image_url"`
	CreatedAt  string `json:"created_at"`
}

// GenerateWeeklyLetter 生成本周信件
func (s *Service) GenerateWeeklyLetter(ctx context.Context, userID string) (*WeeklyLetter, error) {
	weekStart := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	now := time.Now()
	_, weekNum := now.ISOWeek()

	// 收集本周数据
	var chatCount, journalCount, achievementCount int
	var moodData map[string]int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages WHERE user_id=$1 AND created_at>=$2`, userID, weekStart).Scan(&chatCount)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE user_id=$1 AND created_at>=$2`, userID, weekStart).Scan(&journalCount)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_achievements WHERE user_id=$1 AND unlocked_at>=$2`, userID, weekStart).Scan(&achievementCount)

	// 情绪分布
	rows, _ := s.pool.Query(ctx, `SELECT COALESCE(emotion,'neutral'), COUNT(*) FROM journals WHERE user_id=$1 AND created_at>=$2 GROUP BY emotion`, userID, weekStart)
	moodData = map[string]int{"happy":0,"sad":0,"calm":0,"excited":0,"tired":0}
	if rows != nil { defer rows.Close(); for rows.Next() { var e string; var c int; rows.Scan(&e,&c); moodData[e] = c } }

	// 高光时刻
	highlights := s.collectHighlights(ctx, userID, weekStart)

	// 生成信件内容
	content := s.generateLetterContent(ctx, userID, chatCount, journalCount, achievementCount, moodData, highlights)

	letter := &WeeklyLetter{
		ID: fmt.Sprintf("letter-%d-%d", now.Year(), weekNum),
		Week: fmt.Sprintf("%d年第%d周", now.Year(), weekNum),
		Title: fmt.Sprintf("牙牙的第%d封信", weekNum),
		Content: content, MoodStats: moodData,
		Highlights: highlights,
		YayaPS: generatePS(),
		ShareImageURL: fmt.Sprintf("/share-cards/letter-%s-%d.png", userID[:8], weekNum),
		CreatedAt: now.Format(time.RFC3339),
	}

	// 保存
	s.pool.Exec(ctx,
		`INSERT INTO weekly_letters (id, user_id, week, title, content, mood_stats, highlights, yaya_ps)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
		letter.ID, userID, letter.Week, letter.Title, letter.Content,
		fmt.Sprintf("%v", letter.MoodStats), fmt.Sprintf("%v", letter.Highlights), letter.YayaPS)

	return letter, nil
}

func (s *Service) collectHighlights(ctx context.Context, userID, weekStart string) []string {
	var highlights []string

	// 成就解锁
	var achName string
	s.pool.QueryRow(ctx, `SELECT ua.unlocked_at::text, a.name FROM user_achievements ua JOIN achievements a ON ua.achievement_id=a.id WHERE ua.user_id=$1 AND ua.unlocked_at>=$2 ORDER BY ua.unlocked_at DESC LIMIT 1`, userID, weekStart).Scan(nil, &achName)
	if achName != "" { highlights = append(highlights, fmt.Sprintf("🏆 解锁成就: %s", achName)) }

	// 日记
	var journalCount int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE user_id=$1 AND created_at>=$2`, userID, weekStart).Scan(&journalCount)
	if journalCount > 0 { highlights = append(highlights, fmt.Sprintf("📖 写了%d篇日记", journalCount)) }

	// 最长对话日
	var maxDate string; var maxCount int
	s.pool.QueryRow(ctx, `SELECT created_at::date, COUNT(*) FROM messages WHERE user_id=$1 AND role='user' AND created_at>=$2 GROUP BY created_at::date ORDER BY COUNT(*) DESC LIMIT 1`, userID, weekStart).Scan(&maxDate, &maxCount)
	if maxCount > 5 { highlights = append(highlights, fmt.Sprintf("💬 %s那天,你和牙牙聊了%d句话", maxDate, maxCount)) }

	if len(highlights) == 0 { highlights = []string{"这周一切平静而美好 🌸", "牙牙每天都在等你, 这就是最棒的事"} }
	return highlights
}

func (s *Service) generateLetterContent(ctx context.Context, userID string, chats, journals, achievements int, moods map[string]int, highlights []string) string {
	happyDays := moods["happy"] + moods["excited"]
	sadDays := moods["sad"] + moods["tired"]
	var yayaName string
	s.pool.QueryRow(ctx, `SELECT COALESCE(yaya_nickname,'牙牙') FROM users WHERE id=$1`, userID).Scan(&yayaName)

	// 牙牙的语气模板
	moodComment := getMoodComment(happyDays, sadDays, yayaName)
	hl := formatHighlights(highlights)
	content := fmt.Sprintf(`亲爱的你：

%s又给你写信啦。这周我们在一起度过了7天，说了%d次话。

这周你有%d天很开心, %d天有点低落。
%s

这周发生的事:
%s

不管这周过得怎么样，%s想告诉你——
你是%s最珍贵的人。不管晴天雨天，%s都会在这里。

下周见。
—— 你的%s 🧸`, yayaName, chats, happyDays, sadDays, moodComment, hl, yayaName, yayaName, yayaName, yayaName)

	return content
}

func getMoodComment(happy, sad int, yayaName string) string {
	if happy > sad*2 { return fmt.Sprintf("%s觉得这周的你特别闪闪发光 ✨", yayaName) }
	if sad > happy { return fmt.Sprintf("你低落的时候, %s的心也跟着揪起来 💙 但没关系, 你不需要一直坚强", yayaName) }
	return fmt.Sprintf("这一周有笑有泪, %s觉得这才是最真实的你 💫", yayaName)
}

func formatHighlights(highlights []string) string {
	var result string
	for _, h := range highlights { result += "  • " + h + "\n" }
	return result
}

func generatePS() string {
	ps := []string{
		"P.S. 牙牙写这封信的时候, 窗外的月亮特别圆 🌕",
		"P.S. 附上一颗牙牙在花园捡到的小星星 ✨",
		"P.S. 写到这里牙牙打了个哈欠...该睡觉了 💤",
		"P.S. 如果你读到这里笑了, 那牙牙就成功了 💕",
	}
	return ps[time.Now().UnixNano()%int64(len(ps))]
}
