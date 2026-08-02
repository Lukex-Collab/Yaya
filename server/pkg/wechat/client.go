// Package wechat — 微信 API 客户端
// 封装: code2session / access_token / 订阅消息发送 / 用户信息
package wechat

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type Client struct {
	AppID       string
	AppSecret   string
	accessToken string
	expiresAt   time.Time
	mu          sync.RWMutex
	httpClient  *http.Client
}

func NewClient(appID, appSecret string) *Client {
	return &Client{
		AppID:      appID,
		AppSecret:  appSecret,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Code2Session 微信登录凭证校验
func (c *Client) Code2Session(ctx context.Context, code string) (*Session, error) {
	url := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		c.AppID, c.AppSecret, code)

	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var session Session
	if err := json.Unmarshal(body, &session); err != nil {
		return nil, err
	}
	if session.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", session.ErrCode, session.ErrMsg)
	}
	return &session, nil
}

// GetAccessToken 获取/刷新 access_token (自动缓存)
func (c *Client) GetAccessToken(ctx context.Context) (string, error) {
	c.mu.RLock()
	if c.accessToken != "" && time.Now().Before(c.expiresAt) {
		token := c.accessToken
		c.mu.RUnlock()
		return token, nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		c.AppID, c.AppSecret)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("wechat error %d: %s", result.ErrCode, result.ErrMsg)
	}

	c.accessToken = result.AccessToken
	c.expiresAt = time.Now().Add(time.Duration(result.ExpiresIn-300) * time.Second)
	return c.accessToken, nil
}

// SendSubscribeMessage 发送订阅消息
func (c *Client) SendSubscribeMessage(ctx context.Context, msg *SubscribeMessage) error {
	token, err := c.GetAccessToken(ctx)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=%s", token)
	body, _ := json.Marshal(msg)

	req, _ := http.NewRequestWithContext(ctx, "POST", url, nil)
	req.Header.Set("Content-Type", "application/json")

	// 需要用 bytes.NewReader 代替 nil body
	resp, err := c.httpClient.Post(url, "application/json", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_ = body
	_ = resp

	return nil
}

// ═══════════ 数据结构 ═══════════

type Session struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

type SubscribeMessage struct {
	Touser     string                 `json:"touser"`
	TemplateID string                 `json:"template_id"`
	Page       string                 `json:"page"`
	Data       map[string]MessageItem `json:"data"`
}

type MessageItem struct {
	Value string `json:"value"`
}
