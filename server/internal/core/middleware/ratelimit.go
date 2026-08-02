package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

func RateLimit(perSecond int) gin.HandlerFunc {
	var mu sync.Mutex
	tokens := make(map[string]int)
	lastRefill := make(map[string]time.Time)

	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			now := time.Now()
			for ip, t := range lastRefill {
				if now.Sub(t) > time.Minute {
					delete(tokens, ip)
					delete(lastRefill, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()
		defer mu.Unlock()

		now := time.Now()
		if _, ok := lastRefill[ip]; !ok || now.Sub(lastRefill[ip]) > time.Second {
			tokens[ip] = perSecond
			lastRefill[ip] = now
		}

		if tokens[ip] <= 0 {
			response.Error(c, 429, 42900, "rate limit exceeded")
			c.Abort()
			return
		}
		tokens[ip]--
		c.Next()
	}
}
