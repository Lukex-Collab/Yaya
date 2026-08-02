// Package publicfeed — 公共内容流 (牙牙日记广场 + 公众号内容源)
// 用户可以选择公开分享自己的牙牙日记片段
// 形成"大家一起晒牙牙"的社区氛围
//
// 内容源可直接输出到公众号/小红书/朋友圈
package publicfeed

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type PublicMoment struct {
	ID          string `json:"id"`
	AuthorName  string `json:"author_name"`   // 匿名昵称
	AuthorYaya  string `json:"author_yaya"`   // "云狐·小白"
	Content     string `json:"content"`
	Emotion     string `json:"emotion"`
	Likes       int    `json:"likes"`
	Comments    int    `json:"comments"`
	CreatedAt   string `json:"created_at"`
}

type FeedResponse struct {
	Moments []PublicMoment `json:"moments"`
	Total   int            `json:"total"`
}

// GetPublicFeed 获取公共内容流
func (s *Service) GetPublicFeed(ctx context.Context, page int) (*FeedResponse, error) {
	if page < 1 { page = 1 }

	rows, _ := s.pool.Query(ctx,
		`SELECT j.id::text, COALESCE(u.nickname,'匿名用户'), COALESCE(u.yaya_nickname||'·'||COALESCE(ps.species,'云狐'),'牙牙'),
		 COALESCE(j.title,''), COALESCE(j.emotion,'neutral'), COALESCE(j.likes,0), COALESCE(j.comments,0), j.created_at::text
		 FROM journals j JOIN users u ON j.user_id=u.id LEFT JOIN pet_state ps ON ps.user_id=u.id
		 WHERE j.is_private=false AND j.source='ai' ORDER BY j.created_at DESC LIMIT 20 OFFSET $1`, (page-1)*20)
	if rows == nil { return &FeedResponse{}, nil }
	defer rows.Close()

	var moments []PublicMoment
	for rows.Next() { var m PublicMoment; rows.Scan(&m.ID, &m.AuthorName, &m.AuthorYaya, &m.Content, &m.Emotion, &m.Likes, &m.Comments, &m.CreatedAt); moments = append(moments, m) }

	var total int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE is_private=false AND source='ai'`).Scan(&total)

	return &FeedResponse{Moments: moments, Total: total}, nil
}

// LikeMoment 点赞
func (s *Service) LikeMoment(ctx context.Context, momentID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE journals SET likes = COALESCE(likes,0) + 1 WHERE id=$1`, momentID)
	return err
}

// PublishToFeed 发布日记到公共广场
func (s *Service) PublishToFeed(ctx context.Context, journalID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE journals SET is_private=false WHERE id=$1`, journalID)
	return err
}

// GetTodayHighlight 获取今日精选（用于公众号/推送）
func (s *Service) GetTodayHighlight(ctx context.Context) (*PublicMoment, error) {
	today := time.Now().Format("2006-01-02")
	var m PublicMoment
	err := s.pool.QueryRow(ctx,
		`SELECT j.id::text, COALESCE(u.nickname,'匿名'), COALESCE(u.yaya_nickname||'·'||COALESCE(ps.species,'云狐'),'牙牙'),
		 COALESCE(j.title,''), COALESCE(j.emotion,'neutral'), COALESCE(j.likes,0), COALESCE(j.comments,0), j.created_at::text
		 FROM journals j JOIN users u ON j.user_id=u.id LEFT JOIN pet_state ps ON ps.user_id=u.id
		 WHERE j.is_private=false AND j.created_at::date=$1 ORDER BY j.likes DESC NULLS LAST LIMIT 1`, today,
	).Scan(&m.ID, &m.AuthorName, &m.AuthorYaya, &m.Content, &m.Emotion, &m.Likes, &m.Comments, &m.CreatedAt)
	return &m, err
}

// GetWeeklyBest 获取本周精选TOP10（公众号内容源）
func (s *Service) GetWeeklyBest(ctx context.Context) ([]PublicMoment, error) {
	weekStart := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	rows, _ := s.pool.Query(ctx,
		`SELECT j.id::text, COALESCE(u.nickname,'匿名'), COALESCE(u.yaya_nickname||'·'||COALESCE(ps.species,'云狐'),'牙牙'),
		 COALESCE(j.title,''), COALESCE(j.emotion,'neutral'), COALESCE(j.likes,0), COALESCE(j.comments,0), j.created_at::text
		 FROM journals j JOIN users u ON j.user_id=u.id LEFT JOIN pet_state ps ON ps.user_id=u.id
		 WHERE j.is_private=false AND j.created_at>=$1 ORDER BY j.likes DESC LIMIT 10`, weekStart)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var moments []PublicMoment
	for rows.Next() { var m PublicMoment; rows.Scan(&m.ID, &m.AuthorName, &m.AuthorYaya, &m.Content, &m.Emotion, &m.Likes, &m.Comments, &m.CreatedAt); moments = append(moments, m) }
	return moments, nil
}

// GenerateShareCard 生成分享卡片HTML（用于截图分享）
func (s *Service) GenerateShareCard(journalID string) string {
	return fmt.Sprintf(`<div style="background:linear-gradient(135deg,#FFF8F0,#FDF0F3);padding:40px;border-radius:24px;font-family:PingFang SC;text-align:center">
  <div style="font-size:80px">🧸</div>
  <div style="font-size:18px;color:#5C3D2E;margin:16px 0">牙牙的日记</div>
  <div style="font-size:14px;color:#9B8B8B">#灵伴 #牙牙日记</div>
  <div style="font-size:11px;color:#D4A8D6;margin-top:24px">扫描二维码, 和牙牙做朋友</div>
</div>`)
}
