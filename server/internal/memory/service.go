package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	pool   *pgxpool.Pool
	redis  *redis.Client
	client *openai.Client
	apiKey string
}

func NewService(pool *pgxpool.Pool, rdb *redis.Client, deepseek *openai.Client, apiKey string) *Service {
	return &Service{pool: pool, redis: rdb, client: deepseek, apiKey: apiKey}
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

// SearchMemories 搜索相关记忆
// 优先 pgvector 余弦检索，DeepSeek 不提供 Embedding API 时降级为全文匹配
func (s *Service) SearchMemories(ctx context.Context, userID, query string, limit int) ([]Memory, error) {
	if limit < 1 || limit > 20 {
		limit = 10
	}

	// 尝试向量检索
	if queryVec, err := s.embedText(ctx, query); err == nil && queryVec != nil {
		rows, err := s.pool.Query(ctx,
			`SELECT id::text, content, summary, importance, memory_type, decay_factor, access_count, created_at
			 FROM memories WHERE user_id = $1 AND embedding IS NOT NULL
			 ORDER BY embedding <=> $2 LIMIT $3`,
			userID, queryVec, limit,
		)
		if err == nil {
			defer rows.Close()
			return s.scanMemories(rows)
		}
	}

	// 降级：PostgreSQL 全文匹配
	rows, err := s.pool.Query(ctx,
		`SELECT id::text, content, summary, importance, memory_type, decay_factor, access_count, created_at
		 FROM memories WHERE user_id = $1
		 AND (content ILIKE '%' || $2 || '%' OR summary ILIKE '%' || $2 || '%')
		 ORDER BY importance DESC, created_at DESC LIMIT $3`,
		userID, query, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	defer rows.Close()

	return s.scanMemories(rows)
}

func (s *Service) scanMemories(rows pgx.Rows) ([]Memory, error) {
	var memories []Memory
	for rows.Next() {
		var m Memory
		if err := rows.Scan(&m.ID, &m.Content, &m.Summary, &m.Importance,
			&m.MemoryType, &m.DecayFactor, &m.AccessCount, &m.CreatedAt); err != nil {
			continue
		}
		memories = append(memories, m)
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
	if s.pool == nil { return nil }
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

// embedText 向量化文本 — 直连 DeepSeek Embedding API
func (s *Service) embedText(ctx context.Context, text string) ([]float64, error) {
	// openai-go SDK 对自定义 baseURL 的 Embedding 路径有 bug
	// 直连 bypass SDK，确保端点是 /v1/embeddings
	reqBody := map[string]interface{}{
		"model": "text-embedding-3-small",
		"input": []string{text},
	}
	data, _ := json.Marshal(reqBody)

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.deepseek.com/v1/embeddings", strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embedding request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("embedding API %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode embedding: %w", err)
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}
	return result.Data[0].Embedding, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
