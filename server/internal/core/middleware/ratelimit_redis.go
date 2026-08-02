package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RedisRateLimiter 基于 Redis 的分布式滑动窗口限流
// 参考 NVIDIA/go-ratelimit 滑动窗口算法思路
type RedisRateLimiter struct {
	client redis.UniversalClient
	prefix string
}

func NewRedisRateLimiter(client redis.UniversalClient) *RedisRateLimiter {
	return &RedisRateLimiter{
		client: client,
		prefix: "ratelimit:",
	}
}

// SlidingWindow 滑动窗口限流中间件
// window: 时间窗口
// limit: 窗口内最大请求数
func (rl *RedisRateLimiter) SlidingWindow(window time.Duration, limit int) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := rl.key(c)
		now := time.Now().UnixMilli()

		ctx := c.Request.Context()

		// Lua 脚本: 原子操作 — 清理过期 + 计数 + 判断
		script := redis.NewScript(`
			local key = KEYS[1]
			local now = tonumber(ARGV[1])
			local window = tonumber(ARGV[2])
			local limit = tonumber(ARGV[3])

			-- 移除窗口外的记录
			redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

			-- 当前窗口内请求数
			local count = redis.call('ZCARD', key)
			if count >= limit then
				return 0  -- 被限流
			end

			-- 记录本次请求
			redis.call('ZADD', key, now, now .. ':' .. math.random())
			redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
			return 1  -- 通过
		`)

		result, err := script.Run(ctx, rl.client, []string{key}, now, window.Milliseconds(), limit).Int()
		if err != nil {
			slog.Error("rate limiter error", "error", err)
			c.Next() // Redis 故障时放行
			return
		}

		if result == 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code": 42900,
				"msg":  "请求过于频繁，请稍后再试",
			})
			c.Abort()
			return
		}

		// 设置限流响应头
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
		c.Next()
	}
}

// TokenBucket 令牌桶限流（用户级，基于 Redis）
func (rl *RedisRateLimiter) TokenBucket(rate float64, burst int) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := rl.key(c) + ":token"
		ctx := c.Request.Context()
		now := time.Now().Unix()

		script := redis.NewScript(`
			local key = KEYS[1]
			local rate = tonumber(ARGV[1])
			local burst = tonumber(ARGV[2])
			local now = tonumber(ARGV[3])

			-- 获取当前令牌数
			local tokens = tonumber(redis.call('GET', key) or burst)
			local lastRefill = tonumber(redis.call('HGET', key .. ':meta', 'last_refill') or now)

			-- 补充令牌
			local elapsed = now - lastRefill
			tokens = math.min(burst, tokens + elapsed * rate)

			-- 至少要1个令牌
			if tokens < 1 then
				return 0
			end

			tokens = tokens - 1
			redis.call('SET', key, tokens, 'EX', math.ceil(1 / rate) + 10)
			redis.call('HSET', key .. ':meta', 'last_refill', now)
			return 1
		`)

		result, err := script.Run(ctx, rl.client, []string{key}, rate, burst, now).Int()
		if err != nil {
			c.Next()
			return
		}

		if result == 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code": 42900,
				"msg":  "请求过于频繁，请稍后再试",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// key 生成限流 key: ratelimit:{ip}:{path}
func (rl *RedisRateLimiter) key(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.ClientIP()
	}
	return fmt.Sprintf("%s%s:%s", rl.prefix, userID, c.FullPath())
}

// IPBased 基于 IP 的限流（未登录用户）
func (rl *RedisRateLimiter) IPBased(window time.Duration, limit int) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := fmt.Sprintf("%sip:%s:%s", rl.prefix, c.ClientIP(), c.FullPath())
		now := time.Now().UnixMilli()

		script := redis.NewScript(`
			local key = KEYS[1]
			local now = tonumber(ARGV[1])
			local window = tonumber(ARGV[2])
			local limit = tonumber(ARGV[3])
			redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
			local count = redis.call('ZCARD', key)
			if count >= limit then return 0 end
			redis.call('ZADD', key, now, now .. ':' .. math.random())
			redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
			return 1
		`)

		result, err := script.Run(c.Request.Context(), rl.client, []string{key}, now, window.Milliseconds(), limit).Int()
		if err != nil {
			c.Next()
			return
		}

		if result == 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code": 42900, "msg": "too many requests",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// 确保 context 被使用
var _ = context.Background
