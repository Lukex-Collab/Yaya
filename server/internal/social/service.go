package social

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Friend struct {
	ID             string `json:"id"`
	Nickname       string `json:"nickname"`
	PetSpecies     string `json:"pet_species"`
	PetEmoji       string `json:"pet_emoji"`
	PetName        string `json:"pet_name"`
	PetLevel       int    `json:"pet_level"`
	LastActive     string `json:"last_active"`
}

type Visit struct {
	ID         string `json:"id"`
	VisitorID  string `json:"visitor_id"`
	VisitorName string `json:"visitor_name"`
	PetEmoji   string `json:"pet_emoji"`
	CreatedAt  string `json:"created_at"`
}

type FeedItem struct {
	Type       string `json:"type"` // visit/message/achievement/levelup
	FromUserID string `json:"from_user_id"`
	FromName   string `json:"from_name"`
	Content    string `json:"content"`
	CreatedAt  string `json:"created_at"`
}

func (s *Service) GetFriends(ctx context.Context, userID string) ([]Friend, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT u.id::text, u.nickname, COALESCE(ps.species,'云狐'), COALESCE(ps.name,'灵伴'), COALESCE(ps.level,1)
		 FROM friendships f JOIN users u ON f.friend_id=u.id
		 LEFT JOIN pet_state ps ON ps.user_id=u.id
		 WHERE f.user_id=$1 AND f.status='accepted' LIMIT 50`, userID)
	if err != nil { return nil, err }
	defer rows.Close()

	speciesEmoji := map[string]string{"云狐":"🦊","墨猫":"🐱","芽龙":"🐲","泡兔":"🐰","岩熊":"🐻"}
	var friends []Friend
	for rows.Next() {
		var f Friend; var species string
		rows.Scan(&f.ID, &f.Nickname, &species, &f.PetName, &f.PetLevel)
		f.PetSpecies, f.PetEmoji = species, speciesEmoji[species]
		friends = append(friends, f)
	}
	return friends, nil
}

func (s *Service) AddFriend(ctx context.Context, userID, friendID string) (map[string]interface{}, error) {
	if userID == friendID { return nil, nil }
	_, err := s.pool.Exec(ctx,
		`INSERT INTO friendships (user_id, friend_id, status) VALUES ($1,$2,'pending') ON CONFLICT DO NOTHING`, userID, friendID)
	if err != nil { return nil, err }
	return map[string]interface{}{"status": "pending", "msg": "好友请求已发送"}, nil
}

func (s *Service) RemoveFriend(ctx context.Context, userID, friendID string) error {
	if s.pool == nil { return nil }
	_, err := s.pool.Exec(ctx, `DELETE FROM friendships WHERE ((user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)) AND status='accepted'`, userID, friendID)
	return err
}

func (s *Service) GetRecentVisits(ctx context.Context, userID string) ([]Visit, error) {
	rows, _ := s.pool.Query(ctx,
		`SELECT id::text, visitor_id::text, visitor_name, COALESCE(visitor_emoji,'🧸'), created_at::text
		 FROM world_visits WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 20`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var visits []Visit
	for rows.Next() { var v Visit; rows.Scan(&v.ID, &v.VisitorID, &v.VisitorName, &v.PetEmoji, &v.CreatedAt); visits = append(visits, v) }
	return visits, nil
}

func (s *Service) VisitFriend(ctx context.Context, userID, friendID string) (map[string]interface{}, error) {
	visitID := uuid.New().String()
	now := time.Now().Format("2006-01-02T15:04:05Z")

	s.pool.Exec(ctx,
		`INSERT INTO world_visits (id, owner_id, visitor_id, visitor_name, visitor_emoji) VALUES ($1,$2,$3,$4,$5)`,
		visitID, friendID, userID, "朋友", "🧸")
	s.pool.Exec(ctx,
		`INSERT INTO social_feed (user_id, type, from_user_id, content) VALUES ($1,'visit',$2,$3)`,
		friendID, userID, "来拜访了你的灵伴！")

	return map[string]interface{}{"visited": true, "time": now}, nil
}

func (s *Service) LeaveMessage(ctx context.Context, userID, friendID, message string) (map[string]interface{}, error) {
	msgID := uuid.New().String()
	s.pool.Exec(ctx,
		`INSERT INTO social_messages (id, from_user_id, to_user_id, content) VALUES ($1,$2,$3,$4)`,
		msgID, userID, friendID, message)
	s.pool.Exec(ctx,
		`INSERT INTO social_feed (user_id, type, from_user_id, content) VALUES ($1,'message',$2,$3)`,
		friendID, userID, message[:min(len(message),50)])
	return map[string]interface{}{"sent": true}, nil
}

func (s *Service) GetFeed(ctx context.Context, userID string) ([]FeedItem, error) {
	if s.pool == nil { return nil, nil }
	rows, _ := s.pool.Query(ctx,
		`SELECT type, from_user_id::text, COALESCE((SELECT nickname FROM users WHERE id=from_user_id),'朋友'), content, created_at::text
		 FROM social_feed WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()
	var feed []FeedItem
	for rows.Next() { var f FeedItem; rows.Scan(&f.Type, &f.FromUserID, &f.FromName, &f.Content, &f.CreatedAt); feed = append(feed, f) }
	return feed, nil
}

func min(a, b int) int { if a < b { return a }; return b }
