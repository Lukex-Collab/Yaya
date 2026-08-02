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

// Seed 种子数据入口（被 main() 调用）
type Seeder struct {
	pool *pgxpool.Pool
	ctx  context.Context
}

func (s *Seeder) seedAll() {
	fmt.Println("🌱 Seeding database...")
	s.seedAchievements()
	s.seedWomenCalendar()
	s.seedDemoUser()
	fmt.Println("✅ Seed complete!")
}

func seedDatabase(ctx context.Context, pool *pgxpool.Pool) {
	s := &Seeder{pool: pool, ctx: ctx}
	s.seedAll()
}

func (s *Seeder) seedAchievements() {
	fmt.Println("[成就] 初始化...")
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
		s.pool.Exec(s.ctx,
			`INSERT INTO achievements (code, name, description, icon_emoji, category, tier) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
			a.code, a.name, a.desc, a.icon, a.category, a.tier,
		)
		fmt.Printf("  ✓ %s\n", a.code)
	}
	fmt.Printf("  → %d 条成就\n", len(achievements))
}

func (s *Seeder) seedWomenCalendar() {
	type calEvent struct{ mmdd, summary, detail, category string; year int }
	events := []calEvent{
		{"01-01", "居里夫人获诺贝尔化学奖(1911)", "首位两次获诺贝尔奖的科学家", "science", 1911},
		{"01-22", "武则天登基称帝(690)", "中国历史上唯一一位女皇帝", "politics", 690},
		{"02-11", "居里夫人诞辰(1867)", "伟大科学家出生在波兰华沙", "science", 1867},
		{"02-12", "阿达·洛夫莱斯完成首个程序(1843)", "世界第一位程序员", "science", 1843},
		{"03-01", "李清照诞辰(1084)", "千古第一才女", "literature", 1084},
		{"03-08", "国际妇女节确立(1910)", "全球女性共同的节日", "politics", 1910},
		{"03-15", "默克尔出任德国总理(2005)", "德国首位女性领导人", "politics", 2005},
		{"05-12", "南丁格尔诞辰(1820)", "现代护理学创始人", "science", 1820},
		{"06-18", "首位女性诺贝尔经济学奖(2009)", "埃莉诺·奥斯特罗姆", "science", 2009},
		{"07-07", "弗里达·卡罗诞辰(1907)", "墨西哥传奇女画家", "arts", 1907},
		{"07-26", "首位女宇航员诞辰(1937)", "瓦莲京娜·捷列什科娃", "science", 1937},
		{"08-14", "李娜诞辰(1982)", "亚洲第一位网球大满贯冠军", "sports", 1982},
		{"10-05", "屠呦呦获诺贝尔奖(2015)", "首位获科学类诺奖的中国科学家", "science", 2015},
		{"10-24", "林徽因诞辰(1904)", "中国第一位女建筑学家", "science", 1904},
		{"11-01", "王亚平太空行走(2021)", "中国首位女航天员太空行走", "science", 2021},
		{"12-10", "马拉拉获诺贝尔和平奖(2014)", "史上最年轻的诺奖得主", "politics", 2014},
	}
	for _, e := range events {
		s.pool.Exec(s.ctx,
			`INSERT INTO women_calendar (date_mmdd, summary, detail, category, year) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
			e.mmdd, e.summary, e.detail, e.category, e.year,
		)
	}
	fmt.Printf("[女子日历] %d 条历史事件\n", len(events))
}

func (s *Seeder) seedDemoUser() {
	exists := false
	s.pool.QueryRow(s.ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE wechat_openid='demo_user')`).Scan(&exists)
	if exists {
		fmt.Println("[演示账号] 已存在,跳过")
		return
	}
	s.pool.Exec(s.ctx,
		`INSERT INTO users (wechat_openid, nickname, yaya_nickname, companion_days) VALUES ('demo_user','牙牙的朋友','牙牙',42)`)
	s.pool.Exec(s.ctx,
		`INSERT INTO push_settings (user_id) SELECT id FROM users WHERE wechat_openid='demo_user'`)
	fmt.Println("[演示账号] 已创建 (openid=demo_user)")
}

