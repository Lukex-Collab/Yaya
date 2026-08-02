package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/redis/go-redis/v9"

	"github.com/lingpal/platform/internal/core/events"
)

// StreamEvent SSE 流式事件
type StreamEvent struct {
	Content string `json:"content,omitempty"`
	Done    bool   `json:"done"`
	ConvID  string `json:"conv_id,omitempty"`
	Error   string `json:"error,omitempty"`
}

type Service struct {
	client   *openai.Client
	pool     *pgxpool.Pool
	redis    *redis.Client
	pipeline *ChatPipeline
}

func NewService(apiKey, baseURL string, pool *pgxpool.Pool, rdb *redis.Client) *Service {
	opts := []option.RequestOption{
		option.WithAPIKey(apiKey),
	}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}

	return &Service{
		client: openai.NewClient(opts...),
		pool:   pool,
		redis:  rdb,
	}
}

// SetPipeline 注入后处理管线（由 main.go 统一装配）
func (s *Service) SetPipeline(p *ChatPipeline) {
	s.pipeline = p
}

// SendMessage 发送消息，返回 SSE channel
func (s *Service) SendMessage(ctx context.Context, userID, convID, content string) (<-chan StreamEvent, error) {
	// 1. 内容安全过滤
	if ok, reason := s.validateContent(content); !ok {
		ch := make(chan StreamEvent, 1)
		ch <- StreamEvent{Done: true, Error: reason}
		close(ch)
		return ch, nil
	}

	// 2. 创建或获取对话
	if convID == "" {
		id, err := s.createConversation(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("create conversation: %w", err)
		}
		convID = id
	}

	// 3. 保存用户消息
	if err := s.saveMessage(ctx, convID, "user", content); err != nil {
		return nil, fmt.Errorf("save user message: %w", err)
	}

	// 4. 获取上下文
	history, _ := s.getRecentMessages(ctx, convID, 20)
	memories, _ := s.getRecentMemories(ctx, userID)

	// 5. 获取用户画像 + 性格
	prof, _ := s.getUserProfile(ctx, userID)
	personality := s.getOrCachePersonality(ctx, userID, prof.YayaPersonalitySeed)

	// 6. 组装 messages
	systemPrompt := BuildSystemPrompt(
		prof.Nickname, prof.YayaNickname, personality,
		memories,
		time.Now().Format("2006年1月2日 15:04"),
		"", // 天气后续接入
	)

	msgs := []openai.ChatCompletionMessageParamUnion{
		openai.SystemMessage(systemPrompt),
	}
	for _, h := range history {
		if h.role == "user" {
			msgs = append(msgs, openai.UserMessage(h.content))
		} else {
			msgs = append(msgs, openai.AssistantMessage(h.content))
		}
	}
	msgs = append(msgs, openai.UserMessage(content))

	// 7. 流式调用 DeepSeek
	ch := make(chan StreamEvent, 100)
	go s.streamChat(ctx, userID, convID, content, msgs, ch)
	return ch, nil
}

func (s *Service) streamChat(ctx context.Context, userID, convID, userMsg string, msgs []openai.ChatCompletionMessageParamUnion, ch chan<- StreamEvent) {
	defer close(ch)

	stream := s.client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
		Model:       openai.F(openai.ChatModel("deepseek-chat")),
		Messages:    openai.F(msgs),
		Temperature: openai.F(0.8),
		MaxTokens:   openai.F(int64(1024)),
	})

	var fullResponse strings.Builder

	for stream.Next() {
		chunk := stream.Current()
		if len(chunk.Choices) > 0 {
			delta := chunk.Choices[0].Delta.Content
			if delta != "" {
				fullResponse.WriteString(delta)
				ch <- StreamEvent{Content: delta, ConvID: convID}
			}
		}
	}

	if err := stream.Err(); err != nil && err != io.EOF {
		ch <- StreamEvent{Done: true, ConvID: convID, Error: err.Error()}
		return
	}

	// 保存助手消息
	response := fullResponse.String()
	if response != "" {
		s.saveMessage(ctx, convID, "assistant", response)

		// 异步: 写入记忆 + 检测成就 + 建议日记
		// 使用 detached context 保留trace信息但不受父ctx取消影响
		bgCtx := context.WithoutCancel(ctx)
		go s.afterChat(bgCtx, userID, convID, userMsg, response)
	}

	ch <- StreamEvent{Done: true, ConvID: convID}
}

type userProfile struct {
	Nickname            string
	YayaNickname        string
	YayaPersonalitySeed int
}

func (s *Service) getUserProfile(ctx context.Context, userID string) (userProfile, error) {
	var p userProfile
	err := s.pool.QueryRow(ctx,
		`SELECT nickname, yaya_nickname, yaya_personality_seed FROM users WHERE id = $1`,
		userID,
	).Scan(&p.Nickname, &p.YayaNickname, &p.YayaPersonalitySeed)
	return p, err
}

func (s *Service) getOrCachePersonality(ctx context.Context, userID string, seed int) Personality {
	cacheKey := fmt.Sprintf("personality:%s", userID)
	if cached, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
		var p Personality
		if json.Unmarshal([]byte(cached), &p) == nil {
			return p
		}
	}
	p := GeneratePersonality(seed)
	if data, err := json.Marshal(p); err == nil {
		s.redis.Set(ctx, cacheKey, data, 24*time.Hour)
	}
	return p
}

// ---- DB helpers ----

func (s *Service) createConversation(ctx context.Context, userID string) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO conversations (user_id) VALUES ($1) RETURNING id::text`, userID,
	).Scan(&id)
	return id, err
}

func (s *Service) saveMessage(ctx context.Context, convID, role, content string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
		convID, role, content,
	)
	s.pool.Exec(ctx,
		`UPDATE conversations SET message_count = message_count + 1, updated_at = now() WHERE id = $1`, convID)
	return err
}

type historyMsg struct{ role, content string }

func (s *Service) getRecentMessages(ctx context.Context, convID string, limit int) ([]historyMsg, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2`,
		convID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []historyMsg
	for rows.Next() {
		var m historyMsg
		rows.Scan(&m.role, &m.content)
		msgs = append(msgs, m)
	}
	// 反转从旧到新
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	return msgs, nil
}

func (s *Service) getRecentMemories(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT summary FROM memories WHERE user_id = $1 AND importance >= 5
		 ORDER BY created_at DESC LIMIT 5`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memories []string
	for rows.Next() {
		var m string
		rows.Scan(&m)
		memories = append(memories, m)
	}
	return memories, nil
}

func (s *Service) afterChat(ctx context.Context, userID, convID, userMsg, botReply string) {
	if s.pipeline == nil {
		return
	}
	s.pipeline.Run(ctx, events.ChatCompleted{
		UserID:   userID,
		ConvID:   convID,
		UserMsg:  userMsg,
		BotReply: botReply,
	})
}

// validateContent 内容安全校验
func (s *Service) validateContent(input string) (bool, string) {
	text := strings.TrimSpace(input)
	if len(text) == 0 {
		return false, "消息不能为空"
	}
	if len([]rune(text)) > 2000 {
		return false, "消息不能超过2000字"
	}
	return true, ""
}

// GetHistory 对话历史列表
func (s *Service) GetHistory(ctx context.Context, userID string, page, pageSize int) ([]map[string]interface{}, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	rows, err := s.pool.Query(ctx,
		`SELECT id::text, COALESCE(title,''), COALESCE(mood,''), message_count, started_at
		 FROM conversations WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
		userID, pageSize, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []map[string]interface{}
	for rows.Next() {
		var id, title, mood string
		var count int
		var startedAt time.Time
		rows.Scan(&id, &title, &mood, &count, &startedAt)
		if title == "" {
			title = "新的对话"
		}
		convs = append(convs, map[string]interface{}{
			"id": id, "title": title, "mood": mood,
			"message_count": count, "started_at": startedAt,
		})
	}
	return convs, nil
}

// DeleteConversation 删除对话
func (s *Service) DeleteConversation(ctx context.Context, userID, convID string) error {
	var ownerID string
	if err := s.pool.QueryRow(ctx,
		`SELECT user_id::text FROM conversations WHERE id = $1`, convID,
	).Scan(&ownerID); err != nil {
		return fmt.Errorf("conversation not found")
	}
	if ownerID != userID {
		return fmt.Errorf("unauthorized")
	}
	s.pool.Exec(ctx, `DELETE FROM messages WHERE conversation_id = $1`, convID)
	s.pool.Exec(ctx, `DELETE FROM conversations WHERE id = $1`, convID)
	return nil
}

