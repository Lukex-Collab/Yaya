package admin

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/response"
	"github.com/lingpal/platform/pkg/realtime"
)

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/admin/stats", h.GetStats)
	rg.GET("/admin/users", h.ListUsers)
	rg.GET("/admin/users/:id", h.GetUserDetail)
}

// Stats 平台总统计
func (h *Handler) GetStats(c *gin.Context) {
	ctx := c.Request.Context()
	today := time.Now().Format("2006-01-02")

	var totalUsers, todayActive, totalMessages, totalJournals, onlineUsers int

	h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
	h.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT user_id) FROM messages WHERE created_at::date=$1`, today).Scan(&todayActive)
	h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages`).Scan(&totalMessages)
	h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals`).Scan(&totalJournals)
	onlineUsers = realtime.GlobalHub.OnlineCount()

	// 情绪分布
	type moodCount struct {
		Emotion string `json:"emotion"`
		Count   int    `json:"count"`
	}
	var moodStats []moodCount
	rows, _ := h.pool.Query(ctx,
		`SELECT COALESCE(emotion,'unknown'), COUNT(*) FROM journals WHERE created_at >= now()-interval '7 days'
		 GROUP BY emotion ORDER BY COUNT(*) DESC LIMIT 10`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var m moodCount
			rows.Scan(&m.Emotion, &m.Count)
			moodStats = append(moodStats, m)
		}
	}

	// 订阅收入
	var monthlyRevenue int
	h.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount),0) FROM orders WHERE status='paid' AND created_at >= date_trunc('month', now())`,
	).Scan(&monthlyRevenue)

	response.OK(c, gin.H{
		"total_users":    totalUsers,
		"today_active":   todayActive,
		"online_users":   onlineUsers,
		"total_messages": totalMessages,
		"total_journals": totalJournals,
		"weekly_moods":   moodStats,
		"monthly_revenue_fen": monthlyRevenue,
		"server_uptime":  time.Now().Format(time.RFC3339),
	})
}

// ListUsers 用户列表
func (h *Handler) ListUsers(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := h.pool.Query(ctx,
		`SELECT u.id::text, u.nickname, u.yaya_nickname, u.companion_days,
		 COALESCE((SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id=c.id WHERE c.user_id=u.id),0),
		 COALESCE((SELECT status FROM subscriptions WHERE user_id=u.id AND expires_at > now() ORDER BY expires_at DESC LIMIT 1),'free'),
		 u.created_at
		 FROM users u ORDER BY u.created_at DESC LIMIT 100`,
	)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	defer rows.Close()

	type userRow struct {
		ID, Nickname, YayaName, SubStatus string
		CompanionDays, MessageCount       int
		CreatedAt                         time.Time
	}
	var users []userRow
	for rows.Next() {
		var u userRow
		rows.Scan(&u.ID, &u.Nickname, &u.YayaName, &u.CompanionDays, &u.MessageCount, &u.SubStatus, &u.CreatedAt)
		users = append(users, u)
	}
	response.OK(c, users)
}

// GetUserDetail 用户详情
func (h *Handler) GetUserDetail(c *gin.Context) {
	userID := c.Param("id")
	ctx := c.Request.Context()

	var nickname, yayaName string
	var companionDays, messageCount, journalCount, memoryCount int
	var createdAt time.Time

	h.pool.QueryRow(ctx, `SELECT nickname, yaya_nickname FROM users WHERE id=$1`, userID).Scan(&nickname, &yayaName)
	h.pool.QueryRow(ctx, `SELECT companion_days, created_at FROM users WHERE id=$1`, userID).Scan(&companionDays, &createdAt)
	h.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id=c.id WHERE c.user_id=$1`, userID,
	).Scan(&messageCount)
	h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM journals WHERE user_id=$1`, userID).Scan(&journalCount)
	h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM memories WHERE user_id=$1`, userID).Scan(&memoryCount)

	response.OK(c, gin.H{
		"nickname":       nickname,
		"yaya_name":      yayaName,
		"companion_days": companionDays,
		"message_count":  messageCount,
		"journal_count":  journalCount,
		"memory_count":   memoryCount,
		"created_at":     createdAt,
	})
}
