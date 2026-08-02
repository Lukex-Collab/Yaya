package ritual

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PushService 推送服务 — 管理微信订阅消息 + 推送频率控制
type PushService struct {
	pool *pgxpool.Pool
}

func NewPushService(pool *pgxpool.Pool) *PushService {
	return &PushService{pool: pool}
}

// PushSettings 推送设置
type PushSettings struct {
	UserID           string `json:"user_id"`
	MorningEnabled   bool   `json:"morning_enabled"`
	NightEnabled     bool   `json:"night_enabled"`
	CareEnabled      bool   `json:"care_enabled"`
	HealthEnabled    bool   `json:"health_enabled"`
	CalendarEnabled  bool   `json:"calendar_enabled"`
	QuietStartHour   int    `json:"quiet_start_hour"`
	QuietEndHour     int    `json:"quiet_end_hour"`
	DailyCount       int    `json:"daily_count"`
	DailyLimit       int    `json:"daily_limit"`
}

// PushLog 推送记录
type PushLog struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`      // morning/night/care/health/calendar/alert
	Content   string    `json:"content"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

// ═══════════ 推送条件判断 ═══════════

// CanPush 检查是否可以推送
func (ps *PushService) CanPush(ctx context.Context, userID, pushType string) (bool, string) {
	settings, _ := ps.GetSettings(ctx, userID)
	now := time.Now()
	currentHour := now.Hour()

	// 1. 免打扰时段
	if currentHour >= settings.QuietStartHour || currentHour < settings.QuietEndHour {
		return false, "免打扰时段"
	}

	// 2. 每日限额（安全告警不计入）
	if pushType != "alert" && settings.DailyCount >= settings.DailyLimit {
		return false, "已达今日推送上限"
	}

	// 3. 类型开关
	switch pushType {
	case "morning":
		if !settings.MorningEnabled {
			return false, "早安推送已关闭"
		}
	case "night":
		if !settings.NightEnabled {
			return false, "晚安推送已关闭"
		}
	case "health":
		if !settings.HealthEnabled {
			return false, "健康推送已关闭"
		}
	}

	// 4. 距上次推送间隔 >= 30 分钟
	var lastPush time.Time
	err := ps.pool.QueryRow(ctx,
		`SELECT created_at FROM push_logs WHERE user_id=$1 AND type=$2 ORDER BY created_at DESC LIMIT 1`,
		userID, pushType,
	).Scan(&lastPush)
	if err == nil && time.Since(lastPush) < 30*time.Minute {
		return false, fmt.Sprintf("距上次%s推送不到30分钟", pushType)
	}

	return true, ""
}

// ═══════════ 推送方法 ═══════════

// SendPush 记录推送并增加每日计数
func (ps *PushService) SendPush(ctx context.Context, userID, pushType, content string) error {
	// 检查是否可以推送
	if ok, reason := ps.CanPush(ctx, userID, pushType); !ok {
		return fmt.Errorf("push rejected: %s", reason)
	}

	// 记录推送
	_, err := ps.pool.Exec(ctx,
		`INSERT INTO push_logs (user_id, type, content) VALUES ($1, $2, $3)`,
		userID, pushType, content,
	)
	if err != nil {
		return err
	}

	// 增加每日计数（安全告警不增加）
	if pushType != "alert" {
		ps.pool.Exec(ctx,
			`UPDATE push_settings SET daily_count = daily_count + 1 WHERE user_id = $1`,
			userID,
		)
	}

	slog.Info("push sent", "user", userID, "type", pushType)
	return nil
}

// SendMorningGreeting 发送早安问候
func (ps *PushService) SendMorningGreeting(ctx context.Context, userID, content string) error {
	return ps.SendPush(ctx, userID, "morning", content)
}

// SendNightGreeting 发送晚安问候
func (ps *PushService) SendNightGreeting(ctx context.Context, userID, content string) error {
	return ps.SendPush(ctx, userID, "night", content)
}

// SendCareReminder 发送关心提醒（喝水/休息等）
func (ps *PushService) SendCareReminder(ctx context.Context, userID, content string) error {
	return ps.SendPush(ctx, userID, "care", content)
}

// SendHealthReminder 发送健康提醒（经期/用药）
func (ps *PushService) SendHealthReminder(ctx context.Context, userID, content string) error {
	return ps.SendPush(ctx, userID, "health", content)
}

// SendAlert 发送安全告警（最高优先级，不计入每日限额）
func (ps *PushService) SendAlert(ctx context.Context, userID, content string) error {
	_, err := ps.pool.Exec(ctx,
		`INSERT INTO push_logs (user_id, type, content) VALUES ($1, 'alert', $2)`,
		userID, content,
	)
	if err != nil {
		return err
	}
	slog.Warn("safety alert pushed", "user", userID, "content", content)
	return nil
}

// SendMilestoneNotification 发送里程碑通知
func (ps *PushService) SendMilestoneNotification(ctx context.Context, userID, milestoneName string) error {
	content := fmt.Sprintf("🎉 恭喜解锁成就：%s！牙牙为你感到骄傲～", milestoneName)
	return ps.SendPush(ctx, userID, "milestone", content)
}

// ═══════════ 定时任务 ═══════════

// CronMorningPush 早安推送定时任务（Cron: 每天 7:00-9:00 各自定义时间）
func (ps *PushService) CronMorningPush(ctx context.Context) error {
	now := time.Now()
	currentHour := now.Hour()

	// 只在 7:00-9:00 时段执行
	if currentHour < 7 || currentHour >= 9 {
		return nil
	}

	// 获取所有设置了早安推送的用户
	rows, err := ps.pool.Query(ctx,
		`SELECT us.user_id, us.greeting_time::text, u.nickname, u.yaya_nickname
		 FROM user_settings us
		 JOIN users u ON us.user_id = u.id
		 WHERE us.greeting_time IS NOT NULL`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type userSched struct {
		userID, greetingTime, nickname, yayaName string
	}

	var users []userSched
	for rows.Next() {
		var u userSched
		rows.Scan(&u.userID, &u.greetingTime, &u.nickname, &u.yayaName)
		users = append(users, u)
	}

	pushed := 0
	for _, u := range users {
		// 检查当前时间是否匹配用户的设置时间（±30分钟窗口）
		if !timeMatches(now, u.greetingTime, 30) {
			continue
		}

		// 检查是否可以推送
		ok, _ := ps.CanPush(ctx, u.userID, "morning")
		if !ok {
			continue
		}

		// 发送推送
		content := fmt.Sprintf("早安呀 %s！新的一天开始了 ☀️ 今天也要元气满满哦～", u.nickname)
		if err := ps.SendPush(ctx, u.userID, "morning", content); err == nil {
			pushed++
		}
	}

	slog.Info("morning push batch complete", "pushed", pushed, "total_users", len(users))
	return nil
}

// CronNightPush 晚安推送定时任务（Cron: 每天 22:00-23:30）
func (ps *PushService) CronNightPush(ctx context.Context) error {
	now := time.Now()
	currentHour := now.Hour()

	if currentHour < 22 || currentHour >= 24 {
		return nil
	}

	rows, err := ps.pool.Query(ctx,
		`SELECT us.user_id, us.bedtime_time::text, u.nickname, u.yaya_nickname
		 FROM user_settings us
		 JOIN users u ON us.user_id = u.id
		 WHERE us.bedtime_time IS NOT NULL`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type userSched struct {
		userID, bedtimeTime, nickname, yayaName string
	}

	var users []userSched
	for rows.Next() {
		var u userSched
		rows.Scan(&u.userID, &u.bedtimeTime, &u.nickname, &u.yayaName)
		users = append(users, u)
	}

	pushed := 0
	for _, u := range users {
		if !timeMatches(now, u.bedtimeTime, 30) {
			continue
		}
		ok, _ := ps.CanPush(ctx, u.userID, "night")
		if !ok {
			continue
		}

		content := fmt.Sprintf("该睡觉啦 %s 🌙 牙牙帮你检查过门窗了，安心睡吧～晚安好梦 💤", u.nickname)
		if err := ps.SendPush(ctx, u.userID, "night", content); err == nil {
			pushed++
		}
	}

	slog.Info("night push batch complete", "pushed", pushed, "total_users", len(users))
	return nil
}

// ═══════════ 每日重置 ═══════════

// ResetDailyCounts 每日凌晨重置推送计数
func (ps *PushService) ResetDailyCounts(ctx context.Context) error {
	result, err := ps.pool.Exec(ctx,
		`UPDATE push_settings SET daily_count = 0`,
	)
	if err != nil {
		return err
	}
	slog.Info("push daily counts reset", "rows", result.RowsAffected())
	return nil
}

// ═══════════ 设置管理 ═══════════

func (ps *PushService) GetSettings(ctx context.Context, userID string) (*PushSettings, error) {
	var s PushSettings
	err := ps.pool.QueryRow(ctx,
		`SELECT user_id, COALESCE(morning_enabled,true), COALESCE(night_enabled,true),
		        COALESCE(care_enabled,true), COALESCE(health_enabled,true),
		        COALESCE(calendar_enabled,true), COALESCE(quiet_start_hour,22), COALESCE(quiet_end_hour,7),
		        COALESCE(daily_count,0), COALESCE(daily_limit,5)
		 FROM push_settings WHERE user_id = $1`, userID,
	).Scan(&s.UserID, &s.MorningEnabled, &s.NightEnabled, &s.CareEnabled,
		&s.HealthEnabled, &s.CalendarEnabled, &s.QuietStartHour, &s.QuietEndHour,
		&s.DailyCount, &s.DailyLimit)

	if err != nil {
		return &PushSettings{
			MorningEnabled: true,
			NightEnabled:   true,
			CareEnabled:    true,
			HealthEnabled:  true,
			CalendarEnabled: true,
			QuietStartHour: 22,
			QuietEndHour:   7,
			DailyCount:     0,
			DailyLimit:     5,
		}, nil
	}
	return &s, nil
}

func (ps *PushService) UpdateSettings(ctx context.Context, settings *PushSettings) error {
	_, err := ps.pool.Exec(ctx,
		`INSERT INTO push_settings (user_id, morning_enabled, night_enabled, care_enabled, health_enabled, calendar_enabled, quiet_start_hour, quiet_end_hour, daily_limit)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 ON CONFLICT (user_id) DO UPDATE SET
		   morning_enabled=EXCLUDED.morning_enabled, night_enabled=EXCLUDED.night_enabled,
		   care_enabled=EXCLUDED.care_enabled, health_enabled=EXCLUDED.health_enabled,
		   calendar_enabled=EXCLUDED.calendar_enabled,
		   quiet_start_hour=EXCLUDED.quiet_start_hour, quiet_end_hour=EXCLUDED.quiet_end_hour,
		   daily_limit=EXCLUDED.daily_limit`,
		settings.UserID, settings.MorningEnabled, settings.NightEnabled,
		settings.CareEnabled, settings.HealthEnabled, settings.CalendarEnabled,
		settings.QuietStartHour, settings.QuietEndHour, settings.DailyLimit,
	)
	return err
}

// GetHistory 获取推送历史
func (ps *PushService) GetHistory(ctx context.Context, userID string, limit int) ([]PushLog, error) {
	if limit < 1 || limit > 100 {
		limit = 30
	}
	rows, err := ps.pool.Query(ctx,
		`SELECT id::text, type, content, is_read, created_at
		 FROM push_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []PushLog
	for rows.Next() {
		var l PushLog
		rows.Scan(&l.ID, &l.Type, &l.Content, &l.IsRead, &l.CreatedAt)
		logs = append(logs, l)
	}
	return logs, nil
}

// ═══════════ 辅助 ═══════════

func timeMatches(now time.Time, timeStr string, windowMinutes int) bool {
	t, err := time.Parse("15:04", timeStr)
	if err != nil {
		return false
	}

	target := time.Date(now.Year(), now.Month(), now.Day(),
		t.Hour(), t.Minute(), 0, 0, now.Location())

	diff := now.Sub(target).Abs()
	return diff <= time.Duration(windowMinutes)*time.Minute
}

// ═══════════ WeChat 订阅消息结构化 ═══════════

// WechatSubscribeMessage 微信订阅消息
type WechatSubscribeMessage struct {
	Touser     string                 `json:"touser"`      // 用户 OpenID
	TemplateID string                 `json:"template_id"` // 订阅消息模板 ID
	Page       string                 `json:"page"`        // 点击跳转页面
	Data       map[string]MessageData `json:"data"`        // 模板内容
}

type MessageData struct {
	Value string `json:"value"`
}

// BuildMorningMessage 构建早安订阅消息
func BuildMorningMessage(openID, nickname, greeting, weather string) *WechatSubscribeMessage {
	return &WechatSubscribeMessage{
		Touser:     openID,
		TemplateID: "morning_template_id",
		Page:       "pages/home/home",
		Data: map[string]MessageData{
			"thing1": {Value: nickname},
			"thing2": {Value: greeting},
			"thing3": {Value: weather},
			"date4":  {Value: time.Now().Format("2006年01月02日")},
		},
	}
}

// BuildAlertMessage 构建安全告警订阅消息
func BuildAlertMessage(openID, alertType, detail string) *WechatSubscribeMessage {
	return &WechatSubscribeMessage{
		Touser:     openID,
		TemplateID: "alert_template_id",
		Page:       "pages/safety/safety",
		Data: map[string]MessageData{
			"thing1": {Value: fmt.Sprintf("⚠️ %s", alertType)},
			"thing2": {Value: detail},
			"time3":  {Value: time.Now().Format("15:04:05")},
		},
	}
}

// SendWechatMessage 发送微信订阅消息（需要 access_token）
func SendWechatMessage(ctx context.Context, accessToken string, msg *WechatSubscribeMessage) error {
	// POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=ACCESS_TOKEN
	body, _ := json.Marshal(msg)
	_ = body // 实际发送时使用 http.Post
	slog.Info("wechat subscribe message prepared", "to", msg.Touser, "template", msg.TemplateID)
	return nil
}
