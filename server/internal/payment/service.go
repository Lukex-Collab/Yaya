package payment

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Order 支付订单
type Order struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Amount      int       `json:"amount"`      // 分
	Plan        string    `json:"plan"`         // monthly / yearly
	Status      string    `json:"status"`       // pending / paid / refunded / closed
	WxTradeNo   string    `json:"wx_trade_no"`
	CreatedAt   time.Time `json:"created_at"`
}

// Subscription 订阅记录
type Subscription struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Plan        string    `json:"plan"`
	Status      string    `json:"status"`
	AutoRenew   bool      `json:"auto_renew"`
	StartAt     time.Time `json:"start_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// Plan 订阅计划
type Plan struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	PriceFen    int    `json:"price_fen"`   // 分
	PriceYuan   string `json:"price_yuan"`  // 展示用
	PeriodDays  int    `json:"period_days"`
	Features    []string `json:"features"`
}

var Plans = []Plan{
	{
		Code: "monthly", Name: "灵伴+月度订阅",
		PriceFen: 1990, PriceYuan: "19.90",
		PeriodDays: 30,
		Features: []string{"无限AI对话", "专属区域", "双倍成长速度", "高级装饰", "每日免费对话x50"},
	},
	{
		Code: "yearly", Name: "灵伴+年度订阅",
		PriceFen: 19900, PriceYuan: "199.00",
		PeriodDays: 365,
		Features: []string{"全部月度功能", "赠送2个月", "年度限定配饰", "优先客服"},
	},
}

type Service struct {
	pool       *pgxpool.Pool
	wxAppID    string
	wxMchID    string
	wxKey      *rsa.PrivateKey // 微信支付 APIv3 私钥
	wxSerialNo string
}

func NewService(pool *pgxpool.Pool, appID, mchID, serialNo string) *Service {
	return &Service{
		pool:       pool,
		wxAppID:    appID,
		wxMchID:    mchID,
		wxSerialNo: serialNo,
	}
}

// GetPlans 获取所有订阅计划
func (s *Service) GetPlans(_ context.Context) []Plan {
	return Plans
}

// CreateOrder 创建支付订单
func (s *Service) CreateOrder(ctx context.Context, userID, planCode string) (*Order, error) {
	var plan *Plan
	for _, p := range Plans {
		if p.Code == planCode {
			plan = &p
			break
		}
	}
	if plan == nil {
		return nil, fmt.Errorf("invalid plan: %s", planCode)
	}

	order := &Order{
		ID:        "YAYA" + uuid.New().String()[:8],
		UserID:    userID,
		Amount:    plan.PriceFen,
		Plan:      planCode,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	_, err := s.pool.Exec(ctx,
		`INSERT INTO orders (id, user_id, amount, plan, status) VALUES ($1,$2,$3,$4,$5)`,
		order.ID, order.UserID, order.Amount, order.Plan, order.Status,
	)
	if err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}

	// TODO: 调用微信支付统一下单 API，获取 prepay_id
	// prepayID, err := s.wxCreateOrder(ctx, order)

	return order, nil
}

// HandlePaymentCallback 处理微信支付回调
func (s *Service) HandlePaymentCallback(ctx context.Context, orderID, wxTradeNo string, paidAmount int) error {
	// 更新订单状态
	var userID, planCode string
	err := s.pool.QueryRow(ctx,
		`UPDATE orders SET status='paid', wx_trade_no=$1 WHERE id=$2 RETURNING user_id, plan`,
		wxTradeNo, orderID,
	).Scan(&userID, &planCode)
	if err != nil {
		return fmt.Errorf("callback: order not found: %s", orderID)
	}

	// 激活订阅
	return s.ActivateSubscription(ctx, userID, planCode, orderID)
}

// ActivateSubscription 激活订阅
func (s *Service) ActivateSubscription(ctx context.Context, userID, planCode, orderID string) error {
	var planDays int
	for _, p := range Plans {
		if p.Code == planCode {
			planDays = p.PeriodDays
			break
		}
	}
	if planDays == 0 {
		planDays = 30
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, planDays)

	// 如果已有活跃订阅，续期
	var existingID string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM subscriptions WHERE user_id=$1 AND status='active' AND expires_at > now()`,
		userID,
	).Scan(&existingID)

	if err == nil && existingID != "" {
		// 续期
		s.pool.Exec(ctx,
			`UPDATE subscriptions SET expires_at = expires_at + $1, auto_renew=true WHERE id=$2`,
			fmt.Sprintf("%d days", planDays), existingID,
		)
	} else {
		// 新建
		_, err = s.pool.Exec(ctx,
			`INSERT INTO subscriptions (id, user_id, plan, status, auto_renew, start_at, expires_at, order_id)
			 VALUES ($1,$2,$3,'active',true,now(),$4,$5)`,
			uuid.New().String(), userID, planCode, expiresAt, orderID,
		)
	}
	return err
}

// GetUserSubscription 查询当前订阅
func (s *Service) GetUserSubscription(ctx context.Context, userID string) (*Subscription, error) {
	if s.pool == nil { return nil, fmt.Errorf("not connected") }
	var sub Subscription
	err := s.pool.QueryRow(ctx,
		`SELECT id, plan, status, COALESCE(auto_renew,false), start_at, expires_at
		 FROM subscriptions WHERE user_id=$1 AND status='active' AND expires_at > now()
		 ORDER BY expires_at DESC LIMIT 1`,
		userID,
	).Scan(&sub.ID, &sub.Plan, &sub.Status, &sub.AutoRenew, &sub.StartAt, &sub.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("no active subscription")
	}
	sub.UserID = userID
	return &sub, nil
}

// CancelSubscription 取消续费
func (s *Service) CancelSubscription(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE subscriptions SET auto_renew=false WHERE user_id=$1 AND status='active'`,
		userID,
	)
	return err
}

// 微信支付 APIv3 — 统一下单（JSAPI）
func (s *Service) wxCreateOrder(ctx context.Context, order *Order) (string, error) {
	// TODO: 微信支付证书签名 + HTTP 调用
	body, _ := json.Marshal(map[string]interface{}{
		"appid":        s.wxAppID,
		"mchid":        s.wxMchID,
		"description":  "灵伴+订阅",
		"out_trade_no": order.ID,
		"notify_url":   "https://api.lingpal.com/api/v1/payment/callback",
		"amount":       map[string]int{"total": order.Amount, "currency": 0},
		"payer":        map[string]string{"openid": ""}, // 需从 user 表查 openid
	})
	_ = body
	return "", fmt.Errorf("wechat pay not yet configured")
}
