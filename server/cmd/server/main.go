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
	"github.com/lingpal/platform/internal/attachment"
	"github.com/lingpal/platform/internal/bidcare"
	"github.com/lingpal/platform/internal/capsule"
	"github.com/lingpal/platform/internal/chat"
	"github.com/lingpal/platform/internal/dailytopic"
	"github.com/lingpal/platform/internal/nostalgia"
	"github.com/lingpal/platform/internal/core"
	"github.com/lingpal/platform/internal/publicfeed"
	"github.com/lingpal/platform/internal/voiceclone"
	"github.com/lingpal/platform/internal/yayaletter"
	"github.com/lingpal/platform/internal/core/middleware"
	sched "github.com/lingpal/platform/internal/core/scheduler"
	"github.com/lingpal/platform/internal/dream"
	"github.com/lingpal/platform/internal/emotion"
	"github.com/lingpal/platform/internal/evolution"
	"github.com/lingpal/platform/internal/export"
	"github.com/lingpal/platform/internal/hardware"
	"github.com/lingpal/platform/internal/health"
	"github.com/lingpal/platform/internal/journal"
	"github.com/lingpal/platform/internal/memory"
	"github.com/lingpal/platform/internal/nfc"
	"github.com/lingpal/platform/internal/payment"
	"github.com/lingpal/platform/internal/pet"
	"github.com/lingpal/platform/internal/push"
	"github.com/lingpal/platform/internal/quest"
	"github.com/lingpal/platform/internal/ritual"
	"github.com/lingpal/platform/internal/safety"
	"github.com/lingpal/platform/internal/search"
	"github.com/lingpal/platform/internal/share"
	"github.com/lingpal/platform/internal/social"
	"github.com/lingpal/platform/internal/soulmate"
	"github.com/lingpal/platform/internal/tts"
	"github.com/lingpal/platform/internal/upload"
	"github.com/lingpal/platform/internal/user"
	"github.com/lingpal/platform/internal/voice"
	"github.com/lingpal/platform/internal/voicechat"
	"github.com/lingpal/platform/internal/wellness"
	"github.com/lingpal/platform/internal/world"
	"github.com/lingpal/platform/pkg/realtime"

	_ "github.com/joho/godotenv/autoload"
)

// @title 灵伴(LingPal) API — AI陪伴 × 3D世界
// @version 1.0.0
// @description 统一AI陪伴平台: 牙牙(AI守护玩偶) + 灵伴世界(3D宠物探索)
// @contact.name 灵伴开发团队
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
	userSvc := user.NewService(pool, cfg.JWTSecret, cfg.JWTExpireHours, cfg.WechatAppID, cfg.WechatAppSecret)
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
	chatSvc.SetPipeline(chat.NewChatPipeline(pool, rdb, deepseekClient, cfg.DeepSeekAPIKey))
	chatH := chat.NewHandler(chatSvc)
	subGuard := middleware.NewSubscriptionGuard(pool)
	chatAuth := auth.Group("")
	chatAuth.Use(subGuard.ChatQuota())
	chatH.RegisterRoutes(chatAuth)

	// Memory
	memorySvc := memory.NewService(pool, rdb, deepseekClient, cfg.DeepSeekAPIKey)
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

	// Safety（启动BLE硬件模拟器）
	safetySvc := safety.NewService(pool)
	safetySvc.StartSimulator(context.Background())
	safetyH := safety.NewHandler(safetySvc)
	safetyH.RegisterRoutes(auth)

	// Payment
	paymentH := payment.NewHandler(pool)
	paymentH.RegisterRoutes(auth)

	// Push
	pushH := push.NewHandler(pool, deepseekClient)
	pushH.RegisterRoutes(auth)

	// Upload (文件上传)
	uploadH := upload.NewHandler("./uploads")
	uploadH.RegisterRoutes(auth)

	// Voice
	voiceH := voice.NewHandler(pool, cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL)
	voiceH.RegisterRoutes(auth)

	// VoiceChat (实时语音通话 WebRTC)
	voicechatH := voicechat.NewHandler(pool, deepseekClient)
	voicechatH.RegisterRoutes(auth)

	// DailyTopic (每日话题引擎)
	dailytopicH := dailytopic.NewHandler(pool, deepseekClient)
	dailytopicH.RegisterRoutes(auth)

	// Nostalgia (怀旧引擎/那年的今天)
	nostalgiaH := nostalgia.NewHandler(pool)
	nostalgiaH.RegisterRoutes(auth)

	// VoiceClone (声音克隆 Chatterbox TTS)
	vcloneH := voiceclone.NewHandler(pool, "")
	vcloneH.RegisterRoutes(auth)

	// YayaLetter (牙牙每周来信)
	ylH := yayaletter.NewHandler(pool, deepseekClient)
	ylH.RegisterRoutes(auth)

	// PublicFeed (公共内容广场 + 公众号内容源)
	pfeedH := publicfeed.NewHandler(pool)
	pfeedH.RegisterRoutes(auth)

	// World (灵伴世界 3D宠物探索)
	worldH := world.NewHandler(pool)
	worldH.RegisterRoutes(auth)

	// Pet (宠物自主行为)
	petH := pet.NewHandler(pet.NewAutonomousEngine(pool, deepseekClient))
	petH.RegisterRoutes(auth)

	// NFC (实体玩具绑定)
	nfcH := nfc.NewHandler(pool)
	nfcH.RegisterRoutes(auth)

	// Attachment (依恋系统/签到/重逢)
	attachH := attachment.NewHandler(pool)
	attachH.RegisterRoutes(auth)

	// BidCare (双向守护: 照顾牙牙)
	bidcareH := bidcare.NewHandler(pool)
	bidcareH.RegisterRoutes(auth)

	// Capsule (时间胶囊/生命故事)
	capsuleH := capsule.NewHandler(pool)
	capsuleH.RegisterRoutes(auth)

	// Dream (梦境编织者: 每晚专属梦境)
	dreamH := dream.NewHandler(pool, deepseekClient)
	dreamH.RegisterRoutes(auth)

	// Wellness (心情签到/感恩日记/成长报告/关怀鼓励)
	wellnessH := wellness.NewHandler(wellness.NewService(pool, deepseekClient))
	wellnessH.RegisterRoutes(auth)

	// Quest (每日任务挑战)
	questH := quest.NewHandler(quest.NewService(pool))
	questH.RegisterRoutes(auth)

	// Evolution (宠物进化系统)
	evolveH := evolution.NewHandler(evolution.NewService(pool))
	evolveH.RegisterRoutes(auth)

	// TTS (语音合成: 5个牙牙专属音色)
	ttsH := tts.NewHandler(pool, cfg.DeepSeekAPIKey)
	ttsH.RegisterRoutes(auth)

	// Hardware (实体硬件层: 触摸/体温/拥抱)
	hwH := hardware.NewHandler()
	hwH.RegisterRoutes(auth)

	// Soulmate (闺蜜配对: 牙牙社交裂变)
	soulmateH := soulmate.NewHandler(pool)
	soulmateH.RegisterRoutes(auth)

	// Social (好友/拜访/留言)
	socialH := social.NewHandler(pool)
	socialH.RegisterRoutes(auth)

	// Emotion (情绪趋势/报告/急救)
	emotionH := emotion.NewHandler(pool)
	emotionH.RegisterRoutes(auth)

	// Search (全局搜索)
	searchH := search.NewHandler(pool)
	searchH.RegisterRoutes(auth)

	// Share (分享卡片)
	shareH := share.NewHandler()
	shareH.RegisterRoutes(auth)

	// Export (数据导出+账号删除)
	exportH := export.NewHandler(pool)
	exportH.RegisterRoutes(auth)

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
		slog.Info("🚀 灵伴(LingPal) API Gateway starting",
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
