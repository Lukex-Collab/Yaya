package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core/errcode"
	"github.com/lingpal/platform/internal/core/response"
)

// SubscriptionGuard 订阅 + 免费额度守卫
type SubscriptionGuard struct {
	pool *pgxpool.Pool
}

func NewSubscriptionGuard(pool *pgxpool.Pool) *SubscriptionGuard {
	return &SubscriptionGuard{pool: pool}
}

// ChatQuota 检查每日对话额度
func (g *SubscriptionGuard) ChatQuota() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.Next()
			return
		}

		// 检查订阅状态
		if g.hasActiveSubscription(c, userID) {
			c.Next()
			return
		}

		// 免费用户: 每日 50 条消息
		today := time.Now().Format("2006-01-02")
		var count int
		g.pool.QueryRow(c.Request.Context(),
			`SELECT COUNT(*) FROM messages m
			 JOIN conversations c ON m.conversation_id = c.id
			 WHERE c.user_id=$1 AND m.role='user' AND m.created_at::date=$2`,
			userID, today,
		).Scan(&count)

		if count >= 50 {
			response.Error(c, 429, errcode.ErrChatQuotaExceeded, errcode.Message(errcode.ErrChatQuotaExceeded))
			c.Abort()
			return
		}
		c.Next()
	}
}

func (g *SubscriptionGuard) hasActiveSubscription(c *gin.Context, userID string) bool {
	var active bool
	err := g.pool.QueryRow(c.Request.Context(),
		`SELECT EXISTS(
			SELECT 1 FROM subscriptions
			WHERE user_id=$1 AND status='active' AND expires_at > now()
		)`, userID,
	).Scan(&active)
	return err == nil && active
}

// IsSubscriber 检查是否付费用户
func (g *SubscriptionGuard) IsSubscriber(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !g.hasActiveSubscription(c, userID) {
			response.Error(c, 403, errcode.ErrSubExpired, errcode.Message(errcode.ErrSubExpired))
			c.Abort()
			return
		}
		c.Next()
	}
}
