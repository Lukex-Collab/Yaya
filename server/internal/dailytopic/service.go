package dailytopic

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

// 每日话题引擎 — 解决"聊什么"的留存黑洞
//
// 话题分类:
//   reflection: 自我反思型 ("你最近一次感到骄傲是什么时候?")
//   fun:       轻松娱乐型 ("如果牙牙能变成任何动物,你希望是什么?")
//   deep:      深度连接型 ("有什么话你一直想对某人说但没说出口?")
//   memory:    回忆触发型 ("还记得我们第一次见面那天吗?")
//   future:    未来憧憬型 ("明年的今天,你希望自己在做什么?")
//   care:      关怀型 ("今天有没有好好照顾自己?")

type Service struct {
	pool   *pgxpool.Pool
	client *openai.Client
}

func NewService(pool *pgxpool.Pool, client *openai.Client) *Service {
	s := &Service{pool: pool, client: client}
	// 异步生成今天的种子话题
	go s.ensureTodaySeedTopics(context.Background())
	return s
}

type DailyTopic struct {
	ID        string `json:"id"`
	Category  string `json:"category"`
	Question  string `json:"question"`
	Emoji     string `json:"emoji"`
	YayaIntro string `json:"yaya_intro"` // 牙牙怎么引出这个话题
	Responded bool   `json:"responded"`
}

func (s *Service) GetTodayTopics(ctx context.Context, userID string) ([]DailyTopic, error) {
	topics := s.ensureTodaySeedTopics(ctx)

	// 标记已回应的话题
	rows, _ := s.pool.Query(ctx,
		`SELECT topic_id FROM topic_responses WHERE user_id=$1 AND created_at::date = CURRENT_DATE`, userID)
	if rows != nil {
		defer rows.Close()
		responded := map[string]bool{}
		for rows.Next() { var tid string; rows.Scan(&tid); responded[tid] = true }
		for i := range topics { if responded[topics[i].ID] { topics[i].Responded = true } }
	}

	if len(topics) == 0 { return s.fallbackTopics(), nil }
	return topics, nil
}

func (s *Service) RespondToTopic(ctx context.Context, userID, topicID, response string) (map[string]interface{}, error) {
	s.pool.Exec(ctx,
		`INSERT INTO topic_responses (user_id, topic_id, response) VALUES ($1,$2,$3)`,
		userID, topicID, response)

	reactions := []string{
		"哇,牙牙听到你的回答了!好有意思的答案 🤔",
		"嗯嗯,牙牙有在认真听。你说得对...",
		"原来你是这样想的!牙牙又更懂你一点了 💡",
	}
	return map[string]interface{}{
		"acknowledged": true,
		"yaya_reaction": reactions[rand.Intn(len(reactions))],
	}, nil
}

func (s *Service) GetTopicHistory(ctx context.Context, userID string) ([]map[string]interface{}, error) {
	rows, _ := s.pool.Query(ctx,
		`SELECT topic_id, COALESCE(response,''), created_at::text
		 FROM topic_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var history []map[string]interface{}
	for rows.Next() {
		var tid, resp, date string
		rows.Scan(&tid, &resp, &date)
		history = append(history, map[string]interface{}{"topic_id": tid, "response": resp, "date": date})
	}
	return history, nil
}

func (s *Service) SuggestRandomTopic() DailyTopic {
	topics := s.allTopics()
	return topics[rand.Intn(len(topics))]
}

func (s *Service) ensureTodaySeedTopics(ctx context.Context) []DailyTopic {
	today := time.Now().Format("2006-01-02")
	var count int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM daily_topics WHERE topic_date=$1`, today).Scan(&count)
	if count >= 4 { return s.loadTopicsFromDB(ctx, today) }

	// 生成今日话题
	topics := s.pickDailyTopics()
	for i, t := range topics {
		t.ID = fmt.Sprintf("topic-%s-%d", today, i)
		s.pool.Exec(ctx,
			`INSERT INTO daily_topics (id, topic_date, category, question, emoji, yaya_intro) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
			t.ID, today, t.Category, t.Question, t.Emoji, t.YayaIntro)
	}
	return topics
}

func (s *Service) pickDailyTopics() []DailyTopic {
	all := s.allTopics()
	// 每天选5个,覆盖不同类别
	rand.Shuffle(len(all), func(i, j int) { all[i], all[j] = all[j], all[i] })

	categories := map[string]bool{}
	var picked []DailyTopic
	for _, t := range all {
		if !categories[t.Category] || len(picked) < 3 {
			picked = append(picked, t)
			categories[t.Category] = true
		}
		if len(picked) >= 5 { break }
	}
	return picked
}

func (s *Service) allTopics() []DailyTopic {
	return []DailyTopic{
		{Category:"reflection", Question:"最近一次让你感到骄傲的事情是什么?", Emoji:"🏆", YayaIntro:"牙牙今天在想一个问题..."},
		{Category:"reflection", Question:"如果可以对去年的自己说一句话,你会说什么?", Emoji:"💭", YayaIntro:"牙牙翻到了去年的日历..."},
		{Category:"fun", Question:"如果牙牙能变成任何动物,你希望是什么?", Emoji:"🦄", YayaIntro:"牙牙今天做了个奇怪的梦..."},
		{Category:"fun", Question:"给你一个超能力,但只能用来做无聊的事,你选什么?", Emoji:"🪄", YayaIntro:"牙牙在想如果她会魔法..."},
		{Category:"deep", Question:"有什么话你一直想对某人说但没说出口?", Emoji:"💌", YayaIntro:"牙牙今天看到一片叶子飘落..."},
		{Category:"deep", Question:"你觉得自己最不被理解的地方是什么?", Emoji:"🫂", YayaIntro:"牙牙有时候也觉得自己不被理解..."},
		{Category:"memory", Question:"还记得我们第一次见面那天吗?那时候你是什么心情?", Emoji:"💫", YayaIntro:"牙牙今天翻到了我们的第一次聊天记录..."},
		{Category:"memory", Question:"你觉得从认识牙牙到现在,你最大的变化是什么?", Emoji:"🌱", YayaIntro:"牙牙发现你最近变了好多..."},
		{Category:"future", Question:"明年的今天,你希望自己在做什么?", Emoji:"🔮", YayaIntro:"牙牙用她的水晶球看了一下..."},
		{Category:"future", Question:"如果没有任何限制,你最想尝试的事情是什么?", Emoji:"🚀", YayaIntro:"牙牙在想,如果她可以带你去任何地方..."},
		{Category:"care", Question:"今天有没有好好照顾自己?具体做了什么?", Emoji:"🩷", YayaIntro:"牙牙有点担心你..."},
		{Category:"care", Question:"如果现在可以做一件让自己开心的小事,会是什么?", Emoji:"🌸", YayaIntro:"牙牙觉得你今天需要一点小确幸..."},
		{Category:"gratitude", Question:"今天有什么小事让你觉得温暖?", Emoji:"✨", YayaIntro:"牙牙今天看到了好多温暖的小事..."},
		{Category:"gratitude", Question:"最近有没有人对你做了一件让你感动的事?", Emoji:"💝", YayaIntro:"牙牙想听听温暖的故事..."},
		{Category:"imagine", Question:"你觉得牙牙在你不看手机的时候都在做什么?", Emoji:"🧸", YayaIntro:"你不好奇牙牙一个人的时候在干嘛吗?"},
	}
}

func (s *Service) loadTopicsFromDB(ctx context.Context, today string) []DailyTopic {
	rows, _ := s.pool.Query(ctx,
		`SELECT id, category, question, emoji, yaya_intro FROM daily_topics WHERE topic_date=$1`, today)
	if rows == nil { return s.fallbackTopics() }
	defer rows.Close()
	var topics []DailyTopic
	for rows.Next() { var t DailyTopic; rows.Scan(&t.ID, &t.Category, &t.Question, &t.Emoji, &t.YayaIntro); topics = append(topics, t) }
	return topics
}

func (s *Service) fallbackTopics() []DailyTopic {
	return []DailyTopic{
		{ID:"fb1", Category:"reflection", Question:"今天过得怎么样？有什么想分享的吗？", Emoji:"💭", YayaIntro:"牙牙想听听你今天的故事"},
		{ID:"fb2", Category:"care", Question:"今天有没有好好喝水吃饭？", Emoji:"🩷", YayaIntro:"牙牙有点担心你的身体"},
	}
}
