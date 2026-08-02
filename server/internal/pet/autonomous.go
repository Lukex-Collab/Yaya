// Package pet — 宠物自主行为引擎
// 策划文档核心卖点："你不在时，宠物也在生活"
// 基于时间、性格、天气等因子生成每日自然行为序列
package pet

import (
	"context"
	"log/slog"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

type AutonomousEngine struct {
	pool   *pgxpool.Pool
	client *openai.Client
}

func NewAutonomousEngine(pool *pgxpool.Pool, client *openai.Client) *AutonomousEngine {
	return &AutonomousEngine{pool: pool, client: client}
}

// BehaviorLog 宠物行为日志
type BehaviorLog struct {
	Time     string `json:"time"`
	Action   string `json:"action"`
	Emoji    string `json:"emoji"`
	Location string `json:"location"`
}

// GenerateDailyLogs 为所有活跃用户生成今天的宠物自主行为
func (e *AutonomousEngine) GenerateDailyLogs(ctx context.Context) {
	rows, err := e.pool.Query(ctx,
		`SELECT u.id::text, u.yaya_nickname, COALESCE(ps.species,'云狐'), u.yaya_personality_seed
		 FROM users u LEFT JOIN pet_state ps ON u.id = ps.user_id
		 WHERE u.id IN (SELECT DISTINCT user_id FROM messages WHERE created_at > now() - interval '3 days')
		 LIMIT 1000`,
	)
	if err != nil {
		slog.Error("autonomous engine: query users failed", "error", err)
		return
	}
	defer rows.Close()

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	count := 0

	for rows.Next() {
		var userID, yayaName, species string
		var seed int
		rows.Scan(&userID, &yayaName, &species, &seed)

		logs := e.generateLogsForPet(rng, seed, species)
		for _, log := range logs {
			e.pool.Exec(ctx,
				`INSERT INTO pet_activity_logs (user_id, action, emoji, location, created_at)
				 VALUES ($1, $2, $3, $4, now() - $5::interval)`,
				userID, log.Action, log.Emoji, log.Location,
				time.Duration(rng.Intn(12))*time.Hour+time.Duration(rng.Intn(60))*time.Minute,
			)
		}
		count++
	}

	slog.Info("autonomous engine: generated daily logs", "users", count)
}

func (e *AutonomousEngine) generateLogsForPet(rng *rand.Rand, seed int, species string) []BehaviorLog {
	actions := map[string][]struct{ action, emoji string }{
		"云狐": {{"在云端飘了一会儿", "☁️"}, {"追着一只蝴蝶跑", "🦋"}, {"发现了一颗亮晶晶的石头", "💎"}, {"趴在窗边看风景", "🪟"}},
		"墨猫": {{"在月光下晒太阳", "🌙"}, {"偷偷喝了一口主人的牛奶", "🥛"}, {"抓到了一只玩具老鼠", "🐭"}, {"在屋顶上散步", "🏠"}},
		"芽龙": {{"头顶的嫩芽又长高了一点", "🌱"}, {"挖到了奇怪的化石", "🦴"}, {"吃了三颗浆果", "🍓"}, {"在水边玩了一下午", "💧"}},
		"泡兔": {{"跳来跳去练了一小时", "🦘"}, {"找到了新的胡萝卜", "🥕"}, {"吹了三个泡泡", "🫧"}, {"在花园里打盹", "🌸"}},
		"岩熊": {{"搬开一块大石头发现了新路", "🪨"}, {"吃了蜂蜜面包", "🍯"}, {"帮路过的小动物指路", "🐿️"}, {"在山洞里午睡", "⛰️"}},
	}

	speciesActions := actions[species]
	if speciesActions == nil {
		speciesActions = actions["云狐"]
	}

	// 生成 3-8 条今日行为
	count := rng.Intn(6) + 3
	var logs []BehaviorLog
	locations := []string{"灵屿", "星砂海滩", "浆果森林", "星湖", "暖阳山坡", "花园"}

	for i := 0; i < count; i++ {
		act := speciesActions[rng.Intn(len(speciesActions))]
		loc := locations[rng.Intn(len(locations))]
		logs = append(logs, BehaviorLog{
			Action: act.action, Emoji: act.emoji, Location: loc,
		})
	}
	return logs
}

// GetTodayActivity 获取用户宠物今天的活动记录
func (e *AutonomousEngine) GetTodayActivity(ctx context.Context, userID string) ([]BehaviorLog, error) {
	if e.pool == nil { return nil, nil }
	rows, err := e.pool.Query(ctx,
		`SELECT action, emoji, COALESCE(location,''), created_at
		 FROM pet_activity_logs WHERE user_id=$1 AND created_at::date = CURRENT_DATE
		 ORDER BY created_at ASC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []BehaviorLog
	for rows.Next() {
		var l BehaviorLog
		var t time.Time
		rows.Scan(&l.Action, &l.Emoji, &l.Location, &t)
		l.Time = t.Format("15:04")
		logs = append(logs, l)
	}
	return logs, nil
}
