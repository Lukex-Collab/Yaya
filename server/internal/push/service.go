package push

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

// Service 推送消息服务
type Service struct {
	pool   *pgxpool.Pool
	client *openai.Client
}

func NewService(pool *pgxpool.Pool, deepseek *openai.Client) *Service {
	return &Service{pool: pool, client: deepseek}
}

// PushMessage 推送消息记录
type PushMessage struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	MsgType   string `json:"msg_type"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	IsRead    bool   `json:"is_read"`
	CreatedAt string `json:"created_at"`
}

// QueueMorningPush 为所有用户生成早安推送（Cron 调用）
func (s *Service) QueueMorningPush(ctx context.Context) error {
	rows, err := s.pool.Query(ctx,
		`SELECT u.id::text, u.nickname, u.yaya_nickname, COALESCE(us.greeting_time::text, '08:00')
		 FROM users u
		 JOIN user_settings us ON u.id = us.user_id
		 WHERE us.greeting_time::time BETWEEN '06:00' AND '09:30'
		 LIMIT 1000`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type userRow struct {
		id, nickname, yayaName, greetingTime string
	}

	count := 0
	for rows.Next() {
		var u userRow
		rows.Scan(&u.id, &u.nickname, &u.yayaName, &u.greetingTime)

		// AI 生成个性化早安
		greeting := s.generateMorningGreeting(ctx, u.nickname, u.yayaName)

		// 写入推送队列
		s.pool.Exec(ctx,
			`INSERT INTO push_messages (id, user_id, msg_type, title, content) VALUES ($1,$2,'morning','早安',$3)`,
			uuid.New().String(), u.id, greeting,
		)
		count++
	}

	slog.Info("morning push queued", "users", count)
	return nil
}

func (s *Service) generateMorningGreeting(ctx context.Context, nickname, yayaName string) string {
	if s.client == nil {
		return yayaName + ": 早安！今天也要元气满满哦~ ☀️"
	}
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("你是" + yayaName + "，" + nickname + "的宠物。现在是早上，用温暖简短的口吻说早安。20字以内。"),
		}),
		MaxTokens:   openai.F(int64(60)),
		Temperature: openai.F(0.9),
	})
	if err != nil || len(resp.Choices) == 0 {
		return yayaName + ": 早安~ 今天天气真好！"
	}
	return resp.Choices[0].Message.Content
}

// GetUserMessages 获取用户推送消息
func (s *Service) GetUserMessages(ctx context.Context, userID string, unreadOnly bool, limit int) ([]PushMessage, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}

	query := `SELECT id::text, user_id::text, msg_type, COALESCE(title,''), content, is_read, created_at::text
			  FROM push_messages WHERE user_id=$1`
	if unreadOnly {
		query += " AND is_read=false"
	}
	query += " ORDER BY created_at DESC LIMIT $2"

	rows, err := s.pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []PushMessage
	for rows.Next() {
		var m PushMessage
		rows.Scan(&m.ID, &m.UserID, &m.MsgType, &m.Title, &m.Content, &m.IsRead, &m.CreatedAt)
		msgs = append(msgs, m)
	}
	return msgs, nil
}

// MarkAsRead 标记消息已读
func (s *Service) MarkAsRead(ctx context.Context, userID, msgID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE push_messages SET is_read=true WHERE id=$1 AND user_id=$2`, msgID, userID)
	return err
}

// SendAchievementPush 发送成就解锁推送
func (s *Service) SendAchievementPush(ctx context.Context, userID, achName, achIcon string) {
	msg := achIcon + " 恭喜解锁成就: " + achName + "! 继续加油~"
	s.pool.Exec(ctx,
		`INSERT INTO push_messages (id, user_id, msg_type, title, content) VALUES ($1,$2,'achievement','成就解锁',$3)`,
		uuid.New().String(), userID, msg,
	)
}

// SendCarePush 发送关怀推送
func (s *Service) SendCarePush(ctx context.Context, userID, content string) {
	s.pool.Exec(ctx,
		`INSERT INTO push_messages (id, user_id, msg_type, title, content) VALUES ($1,$2,'care','牙牙关心你',$3)`,
		uuid.New().String(), userID, content,
	)
}

// UnreadCount 未读消息数
func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM push_messages WHERE user_id=$1 AND is_read=false`, userID).Scan(&count)
	return count, err
}

// 微信订阅消息模板发送（需要 access_token）
func (s *Service) sendWechatTemplate(_ context.Context, _ string, _ string, _ map[string]interface{}) error {
	// TODO: 获取微信 access_token → 调用 subscribeMessage.send
	// 牙牙的模板消息场景:
	//   - 早安问候提醒
	//   - 成就解锁通知
	//   - 经期预测提醒
	//   - 独居安全告警
	return nil
}

// MarshalJSON for debug
func (m PushMessage) MarshalJSON() ([]byte, error) {
	type Alias PushMessage
	return json.Marshal(&struct{ *Alias }{Alias: (*Alias)(&m)})
}
