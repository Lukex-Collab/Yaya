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
	sched "github.com/lingpal/platform/internal/core/scheduler"
	"github.com/lingpal/platform/internal/health"
	"github.com/lingpal/platform/internal/journal"
	"github.com/lingpal/platform/internal/memory"
	"github.com/lingpal/platform/internal/payment"
	"github.com/lingpal/platform/internal/push"
	"github.com/lingpal/platform/internal/ritual"
	"github.com/lingpal/platform/internal/safety"
	"github.com/lingpal/platform/internal/user"
	"github.com/lingpal/platform/internal/voice"
	"github.com/lingpal/platform/pkg/realtime"

	_ "github.com/joho/godotenv/autoload"
)

// @title 牙牙(Yaya) AI守护玩偶 API
// @version 1.0.0
// @description 灵伴平台 — AI陪伴产品后端服务
// @contact.name 牙牙开发团队
// @host localhost:8080
// @BasePath /api/v1

var startTime = time.Now()

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

	// Redis (optional — degrades gracefully if unavailable)
	rdb, err := core.NewRedisClient(cfg.RedisURL)
	redisOK := err == nil
	if !redisOK {
		slog.Warn("Redis unavailable — running without cache/events/rate-limiting", "error", err)
	} else {
		defer rdb.Close()
		slog.Info("connected to Redis")
	}

	// DeepSeek Client
	deepseekClient := openai.NewClient(
		option.WithAPIKey(cfg.DeepSeekAPIKey),
		option.WithBaseURL(cfg.DeepSeekBaseURL),
	)

	// ── Gin Engine ──
	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Telemetry())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(100))
	r.Use(gin.Recovery())

	// ── 健康检查器 ──
	hc := middleware.NewHealthChecker()
	hc.Register("database", func() error { return pool.Ping(ctx) })
	if redisOK {
		hc.Register("redis", func() error { return rdb.Ping(ctx).Err() })
	}
	r.GET("/health", hc.GinHandler("1.0.0", startTime))
	r.GET("/health/live", middleware.LivenessHandler)
	r.GET("/health/ready", middleware.ReadinessHandler)

	// ── 文档 + 静态资源 ──
	r.Static("/uploads", "./uploads")
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"name":    "牙牙(Yaya) AI守护玩偶",
			"version": "1.0.0",
			"docs":    "/health",
			"api":     "/api/v1",
			"ws":      "/ws",
		})
	})

	// ═══════════ API v1 ═══════════
	v1 := r.Group("/api/v1")

	// ---- 无需认证 ----
	userSvc := user.NewService(pool, cfg.JWTSecret, cfg.JWTExpireHours)
	userH := user.NewHandler(userSvc)
	userH.RegisterPublicRoutes(v1)
	v1.POST("/payment/callback", func(c *gin.Context) {}) // 微信支付回调

	// ---- 需要认证 ----
	auth := v1.Group("")
	auth.Use(middleware.Auth(cfg.JWTSecret))

	// User
	userH.RegisterRoutes(auth)

	// Chat (with subscription guard)
	chatSvc := chat.NewService(cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL, pool, rdb)
	chatSvc.SetPipeline(chat.NewChatPipeline(pool, rdb, deepseekClient))
	chatH := chat.NewHandler(chatSvc)
	subGuard := middleware.NewSubscriptionGuard(pool)
	chatAuth := auth.Group("")
	chatAuth.Use(subGuard.ChatQuota())
	chatH.RegisterRoutes(chatAuth)

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

	// Push
	pushH := push.NewHandler(pool, deepseekClient)
	pushH.RegisterRoutes(auth)

	// Voice
	voiceH := voice.NewHandler(pool, cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL)
	voiceH.RegisterRoutes(auth)

	// Admin
	adminH := admin.NewHandler(pool)
	adminH.RegisterRoutes(auth)

	// ═══════════ WebSocket ═══════════
	ws := r.Group("/ws")
	ws.Use(middleware.Auth(cfg.JWTSecret))
	ws.GET("", realtime.GlobalHub.UpgradeHandler)
	realtime.GlobalHub.OnConnect = func(userID string) {
		slog.Info("user connected via WebSocket", "user_id", userID)
	}
	realtime.GlobalHub.OnDisconnect = func(userID string) {
		slog.Info("user disconnected", "user_id", userID)
	}

	// ═══════════ 定时调度器 ═══════════
	if redisOK {
		s := sched.New(pool, rdb)
		go s.Start(context.Background())
	}

	// ═══════════ 启动 ═══════════
	srv := &http.Server{Addr: ":" + cfg.GatewayPort, Handler: r}

	go func() {
		slog.Info("🚀 牙牙(Yaya) API Gateway starting",
			"port", cfg.GatewayPort,
			"version", "1.0.0",
			"health", "http://localhost:"+cfg.GatewayPort+"/health",
			"ws", "ws://localhost:"+cfg.GatewayPort+"/ws",
		)
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
	slog.Info("server stopped — 牙牙在，就不孤单 🧸")
}
