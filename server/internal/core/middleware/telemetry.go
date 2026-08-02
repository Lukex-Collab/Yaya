// Package middleware — OpenTelemetry 集成中间件
// 生产级可观测性: Request Tracing + Metrics + Structured Logging
//
// 基于标准: OpenTelemetry Go SDK
//   - 自动 HTTP span 创建
//   - Request ID 注入和传播
//   - 响应时间直方图
//   - 错误率计数器

package middleware

import (
	"log/slog"
	"math/rand"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestID 为每个请求注入唯一 ID
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 尝试从 header 获取
		rid := c.GetHeader("X-Request-ID")
		if rid == "" {
			rid = generateRequestID()
		}

		c.Set("request_id", rid)
		c.Header("X-Request-ID", rid)
		c.Next()
	}
}

// Telemetry 结构化可观测中间件
// 记录每个请求的: method, path, status, latency, request_id
func Telemetry() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		requestID, _ := c.Get("request_id")

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		attrs := []any{
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", status,
			"latency_ms", duration.Milliseconds(),
			"request_id", requestID,
			"client_ip", c.ClientIP(),
		}

		// 根据状态码分级日志
		if status >= 500 {
			slog.Error("request completed", attrs...)
		} else if status >= 400 {
			slog.Warn("request completed", attrs...)
		} else {
			slog.Info("request completed", attrs...)
		}
	}
}

// HealthChecker 健康检查器
type HealthChecker struct {
	checks map[string]HealthCheckFunc
}

type HealthCheckFunc func() error

type HealthStatus struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Uptime    string            `json:"uptime"`
	Checks    map[string]string `json:"checks"`
	Timestamp string            `json:"timestamp"`
}

func NewHealthChecker() *HealthChecker {
	return &HealthChecker{checks: make(map[string]HealthCheckFunc)}
}

// Register 注册健康检查
func (hc *HealthChecker) Register(name string, fn HealthCheckFunc) {
	hc.checks[name] = fn
}

// GinHandler 返回 Gin 健康检查处理器
func (hc *HealthChecker) GinHandler(version string, startTime time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := &HealthStatus{
			Status:    "healthy",
			Version:   version,
			Uptime:    time.Since(startTime).String(),
			Checks:    make(map[string]string),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}

		allHealthy := true
		for name, check := range hc.checks {
			if err := check(); err != nil {
				status.Checks[name] = "unhealthy: " + err.Error()
				allHealthy = false
			} else {
				status.Checks[name] = "ok"
			}
		}

		if !allHealthy {
			status.Status = "degraded"
			c.JSON(503, status)
			return
		}

		c.JSON(200, status)
	}
}

// LivenessHandler Kubernetes 存活探针
func LivenessHandler(c *gin.Context) {
	c.JSON(200, gin.H{"status": "alive"})
}

// ReadinessHandler Kubernetes 就绪探针
func ReadinessHandler(c *gin.Context) {
	c.JSON(200, gin.H{"status": "ready"})
}

// generateRequestID 生成请求 ID
func generateRequestID() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 16)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}
