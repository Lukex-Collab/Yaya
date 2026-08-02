package user

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID                  uuid.UUID `json:"id"`
	WechatOpenID        string    `json:"wechat_openid"`
	WechatUnionID       *string   `json:"wechat_unionid,omitempty"`
	Nickname            string    `json:"nickname"`
	AvatarURL           *string   `json:"avatar_url,omitempty"`
	YayaNickname        string    `json:"yaya_nickname"`
	YayaPersonalitySeed int       `json:"yaya_personality_seed"`
	CompanionDays       int       `json:"companion_days"`
	CreatedAt           time.Time `json:"created_at"`
}

type UserSettings struct {
	VoiceEnabled   bool   `json:"voice_enabled"`
	GreetingTime   string `json:"greeting_time"`
	BedtimeTime    string `json:"bedtime_time"`
	HealthReminder bool   `json:"health_reminder"`
	PeriodReminder bool   `json:"period_reminder"`
	PrivacyLevel   int    `json:"privacy_level"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) FindByOpenID(ctx context.Context, openID string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx,
		`SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url,
			yaya_nickname, yaya_personality_seed, companion_days, created_at
		 FROM users WHERE wechat_openid = $1`, openID,
	).Scan(&u.ID, &u.WechatOpenID, &u.WechatUnionID, &u.Nickname,
		&u.AvatarURL, &u.YayaNickname, &u.YayaPersonalitySeed,
		&u.CompanionDays, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx,
		`SELECT id, wechat_openid, wechat_unionid, nickname, avatar_url,
			yaya_nickname, yaya_personality_seed, companion_days, created_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.WechatOpenID, &u.WechatUnionID, &u.Nickname,
		&u.AvatarURL, &u.YayaNickname, &u.YayaPersonalitySeed,
		&u.CompanionDays, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) Create(ctx context.Context, u *User) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO users (wechat_openid, wechat_unionid, nickname, avatar_url)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, yaya_personality_seed, created_at`,
		u.WechatOpenID, u.WechatUnionID, u.Nickname, u.AvatarURL,
	).Scan(&u.ID, &u.YayaPersonalitySeed, &u.CreatedAt)
}

func (r *Repository) Update(ctx context.Context, u *User) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET nickname=$1, avatar_url=$2, yaya_nickname=$3,
		 updated_at=now() WHERE id=$4`,
		u.Nickname, u.AvatarURL, u.YayaNickname, u.ID)
	return err
}

func (r *Repository) GetSettings(ctx context.Context, userID uuid.UUID) (*UserSettings, error) {
	var s UserSettings
	err := r.pool.QueryRow(ctx,
		`SELECT voice_enabled, greeting_time::text, bedtime_time::text,
			health_reminder, period_reminder, privacy_level
		 FROM user_settings WHERE user_id = $1`, userID,
	).Scan(&s.VoiceEnabled, &s.GreetingTime, &s.BedtimeTime,
		&s.HealthReminder, &s.PeriodReminder, &s.PrivacyLevel)
	if err != nil {
		return &UserSettings{
			GreetingTime:   "08:00",
			BedtimeTime:    "22:30",
			HealthReminder: true,
		}, nil
	}
	return &s, nil
}

func (r *Repository) UpsertSettings(ctx context.Context, userID uuid.UUID, s *UserSettings) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO user_settings (user_id, voice_enabled, greeting_time, bedtime_time,
			health_reminder, period_reminder, privacy_level)
		 VALUES ($1, $2, $3::time, $4::time, $5, $6, $7)
		 ON CONFLICT (user_id) DO UPDATE SET
			voice_enabled = EXCLUDED.voice_enabled,
			greeting_time = EXCLUDED.greeting_time,
			bedtime_time = EXCLUDED.bedtime_time,
			health_reminder = EXCLUDED.health_reminder,
			period_reminder = EXCLUDED.period_reminder,
			privacy_level = EXCLUDED.privacy_level`,
		userID, s.VoiceEnabled, s.GreetingTime, s.BedtimeTime,
		s.HealthReminder, s.PeriodReminder, s.PrivacyLevel)
	return err
}
