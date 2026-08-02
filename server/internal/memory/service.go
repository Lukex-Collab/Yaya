package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	pool   *pgxpool.Pool
	redis  *redis.Client
	client *openai.Client
}

func NewService(pool *pgxpool.Pool, rdb *redis.Client, deepseek *openai.Client) *Service {
	return &Service{pool: pool, redis: rdb, client: deepseek}
}

// Memory 记忆体
type Memory struct {
	ID           string    `json:"id"`
	Content      string    `json:"content"`
	Summary      string    `json:"summary"`
	Importance   int       `json:"importance"`
	MemoryType   string    `json:"memory_type"`
	DecayFactor  float64   `json:"decay_factor"`
	AccessCount  int       `json:"access_count"`
	CreatedAt    time.Time `json:"created_at"`
}

// IngestMemory 从对话中提取记忆（异步调用）
func (s *Service) IngestMemory(ctx context.Context, userID, content, sourceMsgID string) error {
	// 使用 DeepSeek 提取记忆要点 + 评分重要性
	summary, importance, err := s.extractMemory(ctx, content)
	if err != nil {
		return err
	}
	if importance < 3 {
		return nil // 跳过不重要的
	}

	// 生成向量
	embedding, err := s.embedText(ctx, content)
	if err != nil {
		return err
	}

	// 写入 pgvector
	_, err = s.pool.Exec(ctx,
		`INSERT INTO memories (user_id, content, summary, embedding, importance, memory_type, source_msg_id)
		 VALUES ($1, $2, $3, $4, $5, 'episodic', $6)`,
		userID, content, summary, embedding, importance, sourceMsgID,
	)
	return err
}

// SearchMemories 语义搜索相关记忆
func (s *Service) SearchMemories(ctx context.Context, userID, query string, limit int) ([]Memory, error) {
	if limit < 1 || limit > 20 {
		limit = 10
	}

	// 向量化查询
	queryVec, err := s.embedText(ctx, query)
	if err != nil {
		return nil, err
	}

	// pgvector 余弦相似度检索
	rows, err := s.pool.Query(ctx,
		`SELECT id::text, content, summary, importance, memory_type, decay_factor, access_count, created_at
		 FROM memories WHERE user_id = $1
		 ORDER BY embedding <=> $2 LIMIT $3`,
		userID, queryVec, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memories []Memory
	for rows.Next() {
		var m Memory
		rows.Scan(&m.ID, &m.Content, &m.Summary, &m.Importance,
			&m.MemoryType, &m.DecayFactor, &m.AccessCount, &m.CreatedAt)
		memories = append(memories, m)
	}

	// 更新检索计数
	for _, m := range memories {
		s.pool.Exec(ctx,
			`UPDATE memories SET access_count = access_count + 1, last_accessed = now() WHERE id = $1`, m.ID)
	}

	return memories, nil
}

// GetCoreFacts 获取"关于你的事实"
func (s *Service) GetCoreFacts(ctx context.Context, userID string) (map[string]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT key, value FROM core_facts WHERE user_id = $1 ORDER BY updated_at DESC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	facts := make(map[string]string)
	for rows.Next() {
		var k, v string
		rows.Scan(&k, &v)
		facts[k] = v
	}
	return facts, nil
}

// ForgetMemory 用户主动删除记忆
func (s *Service) ForgetMemory(ctx context.Context, userID, memoryID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM memories WHERE id = $1 AND user_id = $2`, memoryID, userID)
	return err
}

// ApplyDecay 遗忘衰减（Cron 定期调用）
func (s *Service) ApplyDecay(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE memories SET decay_factor = decay_factor * 0.9
		 WHERE importance < 5 AND created_at < now() - interval '30 days'`)
	return err
}

// extractMemory 使用 DeepSeek 提取记忆
func (s *Service) extractMemory(ctx context.Context, content string) (string, int, error) {
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(`从对话中提取关于用户的重要信息。返回 JSON: {"summary":"...", "importance":1-10}`),
			openai.UserMessage(content),
		}),
		MaxTokens:   openai.F(int64(200)),
		Temperature: openai.F(0.3),
	})
	if err != nil {
		return "", 0, err
	}

	if len(resp.Choices) == 0 {
		return "", 0, fmt.Errorf("no response")
	}

	var result struct {
		Summary    string `json:"summary"`
		Importance int    `json:"importance"`
	}
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &result); err != nil {
		// fallback: 使用原始内容
		return content[:min(len(content), 100)], 5, nil
	}
	return result.Summary, result.Importance, nil
}

// embedText 向量化文本
func (s *Service) embedText(ctx context.Context, text string) ([]float64, error) {
	resp, err := s.client.Embeddings.New(ctx, openai.EmbeddingNewParams{
		Model: openai.F(openai.EmbeddingModelTextEmbedding3Small),
		Input: openai.F[openai.EmbeddingNewParamsInputUnion](openai.EmbeddingNewParamsInputArrayOfStrings([]string{text})),
	})
	if err != nil {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}
	return resp.Data[0].Embedding, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
