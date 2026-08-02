package journal

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

type Journal struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	Title          string    `json:"title"`
	Content        string    `json:"content"`
	Emotion        string    `json:"emotion"`
	EmotionScore   float64   `json:"emotion_score"`
	Weather        string    `json:"weather"`
	LinkedMemories []string  `json:"linked_memories"`
	IsPrivate      bool      `json:"is_private"`
	WordCount      int       `json:"word_count"`
	CreatedAt      string    `json:"created_at"`
}

type Service struct {
	pool   *pgxpool.Pool
	client *openai.Client
}

func NewService(pool *pgxpool.Pool, deepseek *openai.Client) *Service {
	return &Service{pool: pool, client: deepseek}
}

func (s *Service) Create(ctx context.Context, userID, content string, isPrivate bool) (*Journal, error) {
	j := &Journal{
		ID:        uuid.New().String(),
		UserID:    userID,
		Content:   content,
		IsPrivate: isPrivate,
		CreatedAt: time.Now().Format("2006-01-02"),
	}

	// AI 分析情绪 + 自动标题
	go s.analyzeJournal(context.Background(), j)

	_, err := s.pool.Exec(ctx,
		`INSERT INTO journals (id, user_id, title, content, emotion, is_private, word_count, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		j.ID, j.UserID, "正在思考标题...", j.Content, "thinking", j.IsPrivate, len([]rune(j.Content)), j.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return j, nil
}

func (s *Service) analyzeJournal(ctx context.Context, j *Journal) {
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(`分析日记，返回 JSON: {"title":"标题","emotion":"happy/sad/anxious/calm/excited/tired","score":0.0-1.0}`),
			openai.UserMessage(j.Content),
		}),
		MaxTokens:   openai.F(int64(120)),
		Temperature: openai.F(0.5),
	})
	if err != nil || len(resp.Choices) == 0 {
		return
	}

	var result struct {
		Title   string  `json:"title"`
		Emotion string  `json:"emotion"`
		Score   float64 `json:"score"`
	}
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &result); err != nil {
		return
	}

	s.pool.Exec(ctx,
		`UPDATE journals SET title=$1, emotion=$2, emotion_score=$3, updated_at=now() WHERE id=$4`,
		result.Title, result.Emotion, result.Score, j.ID,
	)
}

func (s *Service) List(ctx context.Context, userID, emotion string, page, pageSize int) ([]Journal, error) {
	if page < 1 { page = 1 }
	if pageSize < 1 || pageSize > 50 { pageSize = 20 }
	offset := (page - 1) * pageSize

	var rows pgx.Rows
	var err error
	if emotion != "" {
		rows, err = s.pool.Query(ctx,
			`SELECT id::text, user_id::text, title, content, COALESCE(emotion,''), COALESCE(emotion_score,0),
			 COALESCE(weather,''), is_private, word_count, created_at::text
			 FROM journals WHERE user_id=$1 AND emotion=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
			userID, emotion, pageSize, offset)
	} else {
		rows, err = s.pool.Query(ctx,
			`SELECT id::text, user_id::text, title, content, COALESCE(emotion,''), COALESCE(emotion_score,0),
			 COALESCE(weather,''), is_private, word_count, created_at::text
			 FROM journals WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
			userID, pageSize, offset)
	}
	if err != nil { return nil, err }
	defer rows.Close()

	var journals []Journal
	for rows.Next() {
		var j Journal
		rows.Scan(&j.ID, &j.UserID, &j.Title, &j.Content, &j.Emotion, &j.EmotionScore,
			&j.Weather, &j.IsPrivate, &j.WordCount, &j.CreatedAt)
		journals = append(journals, j)
	}
	return journals, nil
}

func (s *Service) GetByID(ctx context.Context, userID, journalID string) (*Journal, error) {
	var j Journal
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, user_id::text, title, content, COALESCE(emotion,''), COALESCE(emotion_score,0),
		 COALESCE(weather,''), is_private, word_count, created_at::text
		 FROM journals WHERE id=$1 AND user_id=$2`, journalID, userID,
	).Scan(&j.ID, &j.UserID, &j.Title, &j.Content, &j.Emotion, &j.EmotionScore,
		&j.Weather, &j.IsPrivate, &j.WordCount, &j.CreatedAt)
	return &j, err
}

func (s *Service) Update(ctx context.Context, userID, journalID, content string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE journals SET content=$1, updated_at=now() WHERE id=$2 AND user_id=$3`,
		content, journalID, userID)
	return err
}

func (s *Service) Delete(ctx context.Context, userID, journalID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM journals WHERE id=$1 AND user_id=$2`, journalID, userID)
	return err
}

func (s *Service) MoodStats(ctx context.Context, userID, period string) (map[string]int, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT emotion, COUNT(*) FROM journals WHERE user_id=$1 AND created_at >= now() - $2::interval
		 GROUP BY emotion`, userID, period)
	if err != nil { return nil, err }
	defer rows.Close()

	stats := map[string]int{"happy": 0, "sad": 0, "anxious": 0, "calm": 0, "excited": 0, "tired": 0}
	for rows.Next() {
		var e string
		var c int
		rows.Scan(&e, &c)
		stats[e] = c
	}
	return stats, nil
}
