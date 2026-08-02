package admin

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type DashboardStats struct {
	TotalUsers      int            `json:"total_users"`
	TodayActive     int            `json:"today_active"`
	OnlineUsers     int            `json:"online_users"`
	TotalMessages   int            `json:"total_messages"`
	TotalJournals   int            `json:"total_journals"`
	TotalMemories   int            `json:"total_memories"`
	WeeklyMoods     map[string]int `json:"weekly_moods"`
	MonthlyRevenue  int            `json:"monthly_revenue_fen"`
	NewUsersToday   int            `json:"new_users_today"`
}

type UserRow struct {
	ID             string    `json:"id"`
	Nickname       string    `json:"nickname"`
	YayaName       string    `json:"yaya_name"`
	CompanionDays  int       `json:"companion_days"`
	MessageCount   int       `json:"message_count"`
	SubStatus      string    `json:"sub_status"`
	CreatedAt      time.Time `json:"created_at"`
}

func (s *Service) GetDashboard(ctx context.Context) (*DashboardStats, error) {
	if s.pool == nil { return &DashboardStats{}, nil }
	today := time.Now().Format("2006-01-02")
	stats := &DashboardStats{}

	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers)
	s.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT user_id) FROM messages WHERE created_at::date=$1`, today).Scan(&stats.TodayActive)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages`).Scan(&stats.TotalMessages)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals`).Scan(&stats.TotalJournals)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM memories`).Scan(&stats.TotalMemories)
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at::date=$1`, today).Scan(&stats.NewUsersToday)

	rows, _ := s.pool.Query(ctx,
		`SELECT COALESCE(emotion,'neutral'), COUNT(*) FROM journals WHERE created_at >= now()-interval '7 days' GROUP BY emotion`)
	if rows != nil {
		defer rows.Close()
		stats.WeeklyMoods = map[string]int{}
		for rows.Next() { var e string; var c int; rows.Scan(&e, &c); stats.WeeklyMoods[e] = c }
	}
	return stats, nil
}

func (s *Service) ListUsers(ctx context.Context, limit int) ([]UserRow, error) {
	if limit < 1 || limit > 200 { limit = 100 }
	rows, err := s.pool.Query(ctx,
		`SELECT u.id::text, u.nickname, COALESCE(u.yaya_nickname,'牙牙'), u.companion_days,
		 COALESCE((SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id=c.id WHERE c.user_id=u.id),0),
		 COALESCE((SELECT status FROM subscriptions WHERE user_id=u.id AND expires_at>now() ORDER BY expires_at DESC LIMIT 1),'free'),
		 u.created_at FROM users u ORDER BY u.created_at DESC LIMIT $1`, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var users []UserRow
	for rows.Next() { var u UserRow; rows.Scan(&u.ID, &u.Nickname, &u.YayaName, &u.CompanionDays, &u.MessageCount, &u.SubStatus, &u.CreatedAt); users = append(users, u) }
	return users, nil
}
