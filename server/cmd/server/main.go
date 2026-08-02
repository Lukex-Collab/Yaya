package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"

	"github.com/lingpal/platform/internal/achievement"
	"github.com/lingpal/platform/internal/admin"
	"github.com/lingpal/platform/internal/chat"
	"github.com/lingpal/platform/internal/core"
	"github.com/lingpal/platform/internal/core/middleware"
	"github.com/lingpal/platform/internal/core/response"
	sched "github.com/lingpal/platform/internal/core/scheduler"
	"github.com/lingpal/platform/internal/health"
	"github.com/lingpal/platform/internal/journal"
	"github.com/lingpal/platform/internal/memory"
	"github.com/lingpal/platform/internal/payment"
	"github.com/lingpal/platform/internal/push"
	"github.com/lingpal/platform/internal/ritual"
	"github.com/lingpal/platform/internal/safety"
	"github.com/lingpal/platform/internal/user"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	cfg := core.Load()
	ctx := context.Background()

	// PostgreSQL
	pool, err := core.NewPostgresPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to PostgreSQL")

	// Redis
	rdb, err := core.NewRedisClient(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer rdb.Close()
	slog.Info("connected to Redis")

	// DeepSeek Client (openai-go SDK)
	deepseekClient := openai.NewClient(
		option.WithAPIKey(cfg.DeepSeekAPIKey),
		option.WithBaseURL(cfg.DeepSeekBaseURL),
	)

	// Gin 路由
	r := gin.New()
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(100))
	r.Use(gin.Recovery())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		response.OK(c, gin.H{
			"status":  "healthy",
			"version": "1.0.0",
			"modules": []string{"chat", "memory", "journal", "ritual", "health", "achievement", "safety", "payment", "push", "admin"},
		})
	})

	// API v1
	v1 := r.Group("/api/v1")

	// ---- 无需认证 ----
	userSvc := user.NewService(pool, cfg.JWTSecret, cfg.JWTExpireHours)
	userH := user.NewHandler(userSvc)
	userH.RegisterPublicRoutes(v1)

	// 支付回调（无需认证）
	v1.POST("/payment/callback", func(c *gin.Context) {})

	// ---- 需要认证 ----
	auth := v1.Group("")
	auth.Use(middleware.Auth(cfg.JWTSecret))

	// User (protected)
	userH.RegisterRoutes(auth)

	// Chat
	chatSvc := chat.NewService(cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL, pool, rdb)
	chatH := chat.NewHandler(chatSvc)
	chatH.RegisterRoutes(auth)

	// Memory
	memorySvc := memory.NewService(pool, rdb, deepseekClient)
	memoryH := memory.NewHandler(memorySvc)
	memoryH.RegisterRoutes(auth)

	// Journal
	journalSvc := journal.NewService(pool, deepseekClient)
	journalH := journal.NewHandler(journalSvc)
	journalH.RegisterRoutes(auth)

	// Ritual
	ritualSvc := ritual.NewService(pool, deepseekClient)
	ritualH := ritual.NewHandler(ritualSvc, pool)
	ritualH.RegisterRoutes(auth)

	// Health
	healthSvc := health.NewService(pool)
	healthH := health.NewHandler(healthSvc)
	healthH.RegisterRoutes(auth)

	// Achievement
	achievementSvc := achievement.NewService(pool)
	achievementH := achievement.NewHandler(achievementSvc)
	achievementH.RegisterRoutes(auth)

	// Safety
	safetySvc := safety.NewService(pool)
	safetyH := safety.NewHandler(safetySvc)
	safetyH.RegisterRoutes(auth)

	// Payment
	paymentH := payment.NewHandler(pool)
	paymentH.RegisterRoutes(auth)

	// Push Notifications
	pushH := push.NewHandler(pool, deepseekClient)
	pushH.RegisterRoutes(auth)

	// Admin Dashboard
	adminH := admin.NewHandler(pool)
	adminH.RegisterRoutes(auth)

	// 定时调度器（Cron: 推送/记忆衰减/陪伴天数/成就）
	if rdb != nil {
		s := sched.New(pool, rdb)
		go s.Start(context.Background())
	}

	// 启动服务器
	srv := &http.Server{
		Addr:    ":" + cfg.GatewayPort,
		Handler: r,
	}

	go func() {
		slog.Info("lingpal gateway starting", "port", cfg.GatewayPort, "version", "1.0.0")
		slog.Info("API docs: http://localhost:" + cfg.GatewayPort + "/health")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("gateway failed", "error", err)
			os.Exit(1)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
	slog.Info("server stopped")
}
