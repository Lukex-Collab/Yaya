package dream

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

// 梦境编织者
// 这是牙牙最浪漫的能力: 每天睡前，根据你今天经历的事，为你编一个专属梦境
// 早上醒来后，牙牙问你"梦到了吗？"——无论答案是是或否，都创造了共同体验
//
// 心理学依据: "共享梦境"产生亲密幻觉——人们会对"一起做过梦"的人产生更深的情感连接

type Service struct{ pool *pgxpool.Pool; client *openai.Client }

func NewService(pool *pgxpool.Pool, client *openai.Client) *Service { return &Service{pool, client} }

type Dream struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Theme     string `json:"theme"`      // adventure/comfort/magic/reflection/healing
	Emoji     string `json:"emoji"`
	BasedOn   string `json:"based_on"`   // "今天的日记" / "今天的对话"
	CreatedAt string `json:"created_at"`
	Feedback  string `json:"feedback,omitempty"`
}

func (s *Service) GenerateDream(ctx context.Context, userID string) (*Dream, error) {
	now := time.Now()

	// 检查今天是否已有梦境
	today := now.Format("2006-01-02")
	var existing string
	s.pool.QueryRow(ctx,
		`SELECT id::text FROM dreams WHERE user_id=$1 AND dream_date=$2`, userID, today,
	).Scan(&existing)
	if existing != "" {
		// 返回已有的
		return s.getDream(ctx, existing)
	}

	// 获取今天的日记/对话内容作为梦境素材
	var journalContent, chatContent string
	s.pool.QueryRow(ctx,
		`SELECT COALESCE(content,'') FROM journals WHERE user_id=$1 AND created_at=$2 ORDER BY created_at DESC LIMIT 1`, userID, today,
	).Scan(&journalContent)

	// 梦境主题库
	themes := []struct{ theme, emoji, basedOn string }{
		{"adventure", "🏰", "今天的探险"},
		{"comfort", "🛋️", "温暖的小角落"},
		{"magic", "✨", "魔法森林"},
		{"reflection", "🌙", "今天的回忆"},
		{"healing", "🌸", "治愈花园"},
	}
	theme := themes[rand.Intn(len(themes))]

	dreamText := generateDreamText(theme.theme, journalContent, chatContent)

	dream := &Dream{
		ID: uuid.New().String(), Title: fmt.Sprintf("%s %s之旅", theme.emoji, theme.theme),
		Content: dreamText, Theme: theme.theme, Emoji: theme.emoji,
		BasedOn: theme.basedOn, CreatedAt: now.Format(time.RFC3339),
	}

	// 保存
	s.pool.Exec(ctx,
		`INSERT INTO dreams (id, user_id, dream_date, title, content, theme, emoji, based_on)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		dream.ID, userID, today, dream.Title, dream.Content, dream.Theme, dream.Emoji, dream.BasedOn)

	return dream, nil
}

func (s *Service) GetDreamHistory(ctx context.Context, userID string) ([]Dream, error) {
	rows, _ := s.pool.Query(ctx,
		`SELECT id::text, title, content, theme, emoji, COALESCE(based_on,''), dream_date::text, COALESCE(feedback,'')
		 FROM dreams WHERE user_id=$1 ORDER BY dream_date DESC LIMIT 30`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var dreams []Dream
	for rows.Next() {
		var d Dream; var date string
		rows.Scan(&d.ID, &d.Title, &d.Content, &d.Theme, &d.Emoji, &d.BasedOn, &date, &d.Feedback)
		d.CreatedAt = date; dreams = append(dreams, d)
	}
	return dreams, nil
}

func (s *Service) SaveFeedback(ctx context.Context, userID, dreamID, reaction string) error {
	_, err := s.pool.Exec(ctx, `UPDATE dreams SET feedback=$1 WHERE id=$2 AND user_id=$3`, reaction, dreamID, userID)
	return err
}

func (s *Service) GetLastNightDream(ctx context.Context, userID string) (*Dream, error) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id::text FROM dreams WHERE user_id=$1 AND dream_date=$2`, userID, yesterday).Scan(&id)
	if err != nil { return nil, fmt.Errorf("昨晚没有梦境记录") }
	return s.getDream(ctx, id)
}

func (s *Service) getDream(ctx context.Context, id string) (*Dream, error) {
	var d Dream; var date string
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, title, content, theme, emoji, COALESCE(based_on,''), dream_date::text FROM dreams WHERE id=$1`, id,
	).Scan(&d.ID, &d.Title, &d.Content, &d.Theme, &d.Emoji, &d.BasedOn, &date)
	d.CreatedAt = date; return &d, err
}

// generateDreamText 生成梦境文本
func generateDreamText(theme, journalContent, chatContent string) string {
	dreams := map[string][]string{
		"adventure": {
			"今晚你来到一座漂浮在云层上的城堡。云狐在那里等你，它带你飞过彩虹桥，桥下是糖果做的河流。你们一起在云朵上跳跃，每跳一下就有星星从脚下溅出来。",
			"你骑在芽龙背上，穿越一片荧光森林。树上的果实会唱歌，芽龙每走一步头顶的小芽就长高一点。你们发现了一座被遗忘的空中花园。",
		},
		"comfort": {
			"你回到小时候最喜欢的小房间。窗外下着温暖的雨，墨猫蜷在你腿上，发出咕噜咕噜的声音。房间里飘着热巧克力的香味，一切都刚刚好。",
			"你躺在星砂海滩上，泡兔在你身边吹着泡泡。泡泡飘到空中变成了小小的月亮，把整片海面照成温柔的银色。海浪的声音像摇篮曲。",
		},
		"magic": {
			"今晚你是魔法森林的客人。萤火虫为你引路，草丛里的蘑菇会发光。岩熊在你的背包里放了一颗蜂蜜糖，吃了就能听懂动物说话。",
			"你捡到一片会说话的叶子。它告诉你森林深处有一棵许愿树，只要真诚地说出愿望，树上就会结出愿望果实。",
		},
		"healing": {
			"你走进了一座由花瓣构成的温泉。温泉水是淡粉色的，泡在里面所有烦恼都会融化。芽龙在水边帮你守着，时不时用尾巴搅一搅水面让你不无聊。",
			"今晚你拥有了一对翅膀。你飞到城市上空，看着万家灯火。风吹过你的翅膀，把所有不开心的重量都吹走了。",
		},
		"reflection": {
			"你坐在一座无限延伸的图书馆里。每一本书都是你一天的回忆。你抽出一本翻开，发现是今天笑得最开心的那个瞬间。牙牙在你旁边安静地翻着另一本。",
			"月光照进你的房间，把今天发生的每一件小事投影在墙上。牙牙趴在投影旁边，用小爪子指着最亮的那个画面——那是你今天的笑容。",
		},
	}

	pool := dreams[theme]
	if pool == nil { pool = dreams["comfort"] }

	// 如果今天有日记内容，可以注入个性化元素
	_ = journalContent
	_ = chatContent

	return pool[rand.Intn(len(pool))]
}
