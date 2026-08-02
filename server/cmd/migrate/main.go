package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lingpal/platform/internal/core"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	cfg := core.Load()
	ctx := context.Background()

	pool, err := core.NewPostgresPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect to database: %v", err)
	}
	defer pool.Close()

	if len(os.Args) < 2 {
		fmt.Println("Usage: go run cmd/migrate/main.go <up|down|new> [name]")
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "up":
		runMigrations(ctx, pool, "up")
	case "down":
		runMigrations(ctx, pool, "down")
	case "seed":
		seedDatabase(ctx, pool)
	default:
		log.Fatalf("unknown command: %s (use up, down, or seed)", command)
	}
}

func runMigrations(ctx context.Context, pool *pgxpool.Pool, direction string) {
	migrationsDir := filepath.Join("migrations")

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("read migrations dir: %v", err)
	}

	var migrations []string
	for _, f := range files {
		name := f.Name()
		if strings.HasSuffix(name, "."+direction+".sql") {
			migrations = append(migrations, name)
		}
	}
	sort.Strings(migrations)

	for _, m := range migrations {
		sqlBytes, err := os.ReadFile(filepath.Join(migrationsDir, m))
		if err != nil {
			log.Fatalf("read migration %s: %v", m, err)
		}
		sql := string(sqlBytes)
		if _, err := pool.Exec(ctx, sql); err != nil {
			log.Fatalf("execute %s: %v", m, err)
		}
		fmt.Printf("  ✓ %s\n", m)
	}
	fmt.Println("\nMigrations complete!")
}

func seedDatabase(ctx context.Context, pool *pgxpool.Pool) {
	// Seed achievements
	achievements := []struct{ code, name, desc, icon, category string; tier int }{
		{"first_chat", "初次见面", "完成第一次对话", "💬", "milestone", 1},
		{"seven_days", "七日之约", "连续陪伴7天", "🌟", "milestone", 2},
		{"thirty_days", "三十天老友", "连续陪伴30天", "💫", "milestone", 3},
		{"hundred_days", "百天同行", "陪伴100天", "👑", "milestone", 3},
		{"chatterbox", "话匣子", "累计对话1000条", "🗣️", "special", 2},
		{"journal_master", "日记达人", "写满30篇日记", "📖", "special", 2},
		{"morning_bird", "早安鸟儿", "连续7天早安签到", "🌅", "social", 1},
		{"night_owl", "晚安宝贝", "连续7天晚安打卡", "🌙", "social", 1},
		{"happy_week", "情绪稳定", "连续7天情绪为happy", "😊", "emotion", 2},
		{"health_keeper", "健康管理师", "连续记录经期3个月", "🩷", "special", 2},
		{"collector", "收藏家", "解锁所有成就", "🏆", "special", 3},
	}

	for _, a := range achievements {
		pool.Exec(ctx,
			`INSERT INTO achievements (code, name, description, icon_emoji, category, tier) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
			a.code, a.name, a.desc, a.icon, a.category, a.tier,
		)
		fmt.Printf("  ✓ %s\n", a.code)
	}
	fmt.Println("\nSeed complete!")
}
