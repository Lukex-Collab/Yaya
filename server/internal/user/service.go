package user

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	repo       *Repository
	jwtSecret  string
	jwtExpire  time.Duration
	wechatAppID string
	wechatAppSecret string
}

func NewService(pool *pgxpool.Pool, jwtSecret string, jwtExpireHours int, wechatAppID, wechatAppSecret string) *Service {
	return &Service{
		repo:       NewRepository(pool),
		jwtSecret:  jwtSecret,
		jwtExpire:  time.Duration(jwtExpireHours) * time.Hour,
		wechatAppID: wechatAppID,
		wechatAppSecret: wechatAppSecret,
	}
}

type WechatSession struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
	IsNew bool   `json:"is_new"`
}

func (s *Service) WeChatLogin(ctx context.Context, code, nickname, avatarURL string) (*LoginResponse, error) {
	session, err := s.code2session(code)
	if err != nil {
		return nil, fmt.Errorf("wechat auth: %w", err)
	}

	user, err := s.repo.FindByOpenID(ctx, session.OpenID)
	isNew := false

	if err != nil {
		user = &User{
			WechatOpenID: session.OpenID,
			Nickname:     nickname,
		}
		if session.UnionID != "" {
			user.WechatUnionID = &session.UnionID
		}
		if avatarURL != "" {
			user.AvatarURL = &avatarURL
		}
		if err := s.repo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("create user: %w", err)
		}
		isNew = true
	}

	token, err := s.generateJWT(user.ID.String())
	if err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}

	return &LoginResponse{Token: token, User: user, IsNew: isNew}, nil
}

func (s *Service) code2session(code string) (*WechatSession, error) {
	// 开发模式: "dev" 作为 code，返回 mock 数据
	if code == "dev" {
		return &WechatSession{
			OpenID:     "dev_" + uuid.New().String()[:8],
			SessionKey: "dev_session_key",
		}, nil
	}

	appID := "your-wechat-appid"
	appSecret := "your-wechat-secret"
	url := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		appID, appSecret, code)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var session WechatSession
	json.Unmarshal(body, &session)

	if session.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", session.ErrCode, session.ErrMsg)
	}
	return &session, nil
}

func (s *Service) generateJWT(userID string) (string, error) {
	claims := struct {
		UserID string `json:"user_id"`
		jwt.RegisteredClaims
	}{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.jwtExpire)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}
	return s.repo.FindByID(ctx, id)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, nickname, yayaNickname, avatarURL *string) (*User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	user, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if nickname != nil {
		user.Nickname = *nickname
	}
	if yayaNickname != nil {
		user.YayaNickname = *yayaNickname
	}
	if avatarURL != nil {
		user.AvatarURL = avatarURL
	}
	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) GetSettings(ctx context.Context, userID string) (*UserSettings, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetSettings(ctx, id)
}

func (s *Service) UpdateSettings(ctx context.Context, userID string, settings *UserSettings) error {
	id, err := uuid.Parse(userID)
	if err != nil {
		return err
	}
	return s.repo.UpsertSettings(ctx, id, settings)
}
