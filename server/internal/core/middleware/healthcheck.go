package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthChecker 健康检查器
type HealthChecker struct {
	mu       sync.RWMutex
	services map[string]func() error
}

func NewHealthChecker() *HealthChecker {
	return &HealthChecker{services: make(map[string]func() error)}
}

func (h *HealthChecker) Register(name string, check func() error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.services[name] = check
}

// GinHandler 健康检查 handler
func (h *HealthChecker) GinHandler(version string, startTime time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		h.mu.RLock()
		defer h.mu.RUnlock()

		services := make(map[string]string)
		healthy := true

		for name, check := range h.services {
			if err := check(); err != nil {
				services[name] = "unhealthy: " + err.Error()
				healthy = false
			} else {
				services[name] = "healthy"
			}
		}

		status := http.StatusOK
		if !healthy {
			status = http.StatusServiceUnavailable
		}

		c.JSON(status, gin.H{
			"status":   map[bool]string{true: "ok", false: "degraded"}[healthy],
			"version":  version,
			"uptime":   time.Since(startTime).String(),
			"services": services,
		})
	}
}

// LivenessHandler k8s liveness probe 专用
func LivenessHandler(c *gin.Context) {
	c.JSON(200, gin.H{"alive": true})
}

// ReadinessHandler k8s readiness probe 专用
func ReadinessHandler(c *gin.Context) {
	c.JSON(200, gin.H{"ready": true})
}
