package chat

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/redis/go-redis/v9"

	"github.com/lingpal/platform/internal/core/events"
)

// ChatPipeline 对话后处理管线
type ChatPipeline struct {
	pool     *pgxpool.Pool
	rdb      *redis.Client
	deepseek *openai.Client
	apiKey   string
}

func NewChatPipeline(pool *pgxpool.Pool, rdb *redis.Client, deepseek *openai.Client, apiKey string) *ChatPipeline {
	return &ChatPipeline{pool: pool, rdb: rdb, deepseek: deepseek, apiKey: apiKey}
}

// Run 对话完成后执行全管线
func (h *ChatPipeline) Run(ctx context.Context, event events.ChatCompleted) {
	// 并步执行不阻塞对话返回
	go h.ingestMemory(ctx, event)
	go h.checkAchievements(ctx, event)
	if len([]rune(event.UserMsg)) >= 50 {
		go h.autoJournal(ctx, event)
	}
}

// ---- 记忆摄取 ----
func (h *ChatPipeline) ingestMemory(ctx context.Context, event events.ChatCompleted) {
	if h.deepseek == nil {
		return
	}

	summary, importance, err := h.extractMemory(ctx, event.UserMsg+"\n"+event.BotReply)
	if err != nil || importance < 3 {
		return
	}

	embedding, err := h.embedText(ctx, summary)
	if err != nil {
		return
	}

	_, err = h.pool.Exec(ctx,
		`INSERT INTO memories (user_id, content, summary, embedding, importance, memory_type)
		 VALUES ($1, $2, $3, $4, $5, 'episodic')`,
		event.UserID, event.UserMsg+"; "+event.BotReply, summary, embedding, importance,
	)
	if err != nil {
		slog.Error("memory ingest failed", "error", err)
	} else {
		slog.Info("memory stored", "user", event.UserID, "importance", importance)
	}

	go h.extractCoreFact(ctx, event)
}

func (h *ChatPipeline) extractMemory(ctx context.Context, content string) (string, int, error) {
	resp, err := h.deepseek.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("从对话中提取关于用户的一条重要信息。只返回JSON: {\"summary\":\"...\",\"importance\":1-10}"),
			openai.UserMessage(content),
		}),
		MaxTokens:   openai.F(int64(150)),
		Temperature: openai.F(0.3),
	})
	if err != nil || len(resp.Choices) == 0 {
		return "", 0, err
	}

	var r struct {
		Summary    string `json:"summary"`
		Importance int    `json:"importance"`
	}
	json.Unmarshal([]byte(resp.Choices[0].Message.Content), &r)
	if r.Summary == "" {
		return "", 0, nil
	}
	return r.Summary, r.Importance, nil
}

func (h *ChatPipeline) embedText(ctx context.Context, text string) ([]float64, error) {
	reqBody := map[string]interface{}{
		"model": "text-embedding-3-small",
		"input": []string{text},
	}
	data, _ := json.Marshal(reqBody)
	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.deepseek.com/v1/embeddings", strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, nil // 静默失败，不阻断管线
	}

	var result struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Data) == 0 {
		return nil, nil
	}
	return result.Data[0].Embedding, nil
}

func (h *ChatPipeline) extractCoreFact(ctx context.Context, event events.ChatCompleted) {
	resp, err := h.deepseek.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("从对话中提取用户的持久事实。返回JSON: {\"key\":\"类型\",\"value\":\"内容\"}。无重要事实返回{\"key\":\"none\"}"),
			openai.UserMessage(event.UserMsg+"\n"+event.BotReply),
		}),
		MaxTokens:   openai.F(int64(100)),
		Temperature: openai.F(0.1),
	})
	if err != nil || len(resp.Choices) == 0 {
		return
	}

	var fact struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	json.Unmarshal([]byte(resp.Choices[0].Message.Content), &fact)
	if fact.Key == "none" || fact.Key == "" || fact.Value == "" {
		return
	}

	h.pool.Exec(ctx,
		`INSERT INTO core_facts (user_id, key, value) VALUES ($1,$2,$3)
		 ON CONFLICT (user_id,key) DO UPDATE SET value=$3, confidence=0.9, updated_at=now()`,
		event.UserID, fact.Key, fact.Value,
	)
}

// ---- 成就检测 ----
func (h *ChatPipeline) checkAchievements(ctx context.Context, event events.ChatCompleted) {
	h.incrAchievement(ctx, event.UserID, "first_chat", 1)
	h.incrAchievement(ctx, event.UserID, "chatterbox", 1)
	h.checkCompanionDays(ctx, event.UserID)
}

func (h *ChatPipeline) incrAchievement(ctx context.Context, userID, code string, inc int) {
	var achID string
	var target int
	if err := h.pool.QueryRow(ctx,
		`SELECT id::text, target FROM achievements WHERE code=$1`, code,
	).Scan(&achID, &target); err != nil {
		return
	}

	h.pool.Exec(ctx,
		`INSERT INTO user_achievements (user_id, achievement_id, progress, target)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (user_id,achievement_id) DO UPDATE SET progress=user_achievements.progress+$3`,
		userID, achID, inc, target,
	)

	var prog int
	var unlocked bool
	h.pool.QueryRow(ctx,
		`SELECT progress, unlocked_at IS NOT NULL FROM user_achievements
		 WHERE user_id=$1 AND achievement_id=$2`, userID, achID,
	).Scan(&prog, &unlocked)

	if prog >= target && !unlocked {
		h.pool.Exec(ctx,
			`UPDATE user_achievements SET unlocked_at=now() WHERE user_id=$1 AND achievement_id=$2`,
			userID, achID,
		)
		slog.Info("achievement unlocked", "user", userID, "achievement", code)
	}
}

func (h *ChatPipeline) checkCompanionDays(ctx context.Context, userID string) {
	var days int
	h.pool.QueryRow(ctx, `SELECT companion_days FROM users WHERE id=$1`, userID).Scan(&days)
	for _, d := range []struct {
		code   string
		target int
	}{
		{"seven_days", 7},
		{"thirty_days", 30},
		{"hundred_days", 100},
	} {
		if days >= d.target {
			h.incrAchievement(ctx, userID, d.code, 0)
		}
	}
}

// ---- 自动日记 ----
func (h *ChatPipeline) autoJournal(ctx context.Context, event events.ChatCompleted) {
	_, err := h.pool.Exec(ctx,
		`INSERT INTO journals (user_id, content, created_at)
		 VALUES ($1, $2, CURRENT_DATE)`,
		event.UserID, "[自动]" + event.UserMsg,
	)
	if err == nil {
		slog.Info("journal auto-saved", "user", event.UserID)
	}
}
