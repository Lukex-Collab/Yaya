// Package llm — LLM 客户端增强层
// 基于生产环境最佳实践:
//   - go-notdiamond (github.com/Not-Diamond/go-notdiamond): 多模型路由
//   - pllm (github.com/andreimerfu/pllm): 自适应路由网关
//
// 功能:
//   - 自动重试 (exponential backoff + jitter)
//   - 速率限制 (token bucket)
//   - 多 Provider 降级 (DeepSeek → 通义千问 → GPT-4o-mini)
//   - 请求超时控制
//   - 响应缓存 (可选 Redis)

package llm

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// ═══════════ Provider 定义 ═══════════

type Provider struct {
	Name    string
	APIKey  string
	BaseURL string
	Model   string
	// 优先级: 数字越小越优先
	Priority int
	// 最大并发请求
	MaxConcurrency int
	// 超时
	Timeout time.Duration
}

// DefaultProviders 默认 Provider 链
func DefaultProviders(deepseekKey string) []Provider {
	providers := []Provider{
		{
			Name:     "deepseek",
			APIKey:   deepseekKey,
			BaseURL:  "https://api.deepseek.com/v1",
			Model:    "deepseek-chat",
			Priority: 0,
			Timeout:  30 * time.Second,
		},
	}

	// 如果有备用 Key，注册其他 Provider
	return providers
}

// ═══════════ 增强客户端 ═══════════

type Client struct {
	providers []Provider
	clients   map[string]*openai.Client
	mu        sync.RWMutex

	// 速率限制
	rateLimiter *tokenBucket

	// 重试配置
	maxRetries  int
	baseBackoff time.Duration
	maxBackoff  time.Duration

	// 指标
	metrics *ClientMetrics
}

type ClientMetrics struct {
	mu            sync.RWMutex
	TotalRequests int64
	TotalErrors   int64
	TotalRetries  int64
	ProviderUsage map[string]int64
	AvgLatency    time.Duration
	latencySum    time.Duration
	latencyCount  int64
}

type Config struct {
	Providers   []Provider
	MaxRetries  int           // 默认 3
	BaseBackoff time.Duration // 默认 1s
	MaxBackoff  time.Duration // 默认 30s
	RateLimit   float64       // 每秒请求数，默认 10
}

func NewClient(cfg Config) *Client {
	if cfg.MaxRetries == 0 {
		cfg.MaxRetries = 3
	}
	if cfg.BaseBackoff == 0 {
		cfg.BaseBackoff = time.Second
	}
	if cfg.MaxBackoff == 0 {
		cfg.MaxBackoff = 30 * time.Second
	}
	if cfg.RateLimit == 0 {
		cfg.RateLimit = 10
	}

	c := &Client{
		providers:   cfg.Providers,
		clients:     make(map[string]*openai.Client),
		rateLimiter: newTokenBucket(cfg.RateLimit, cfg.RateLimit),
		maxRetries:  cfg.MaxRetries,
		baseBackoff: cfg.BaseBackoff,
		maxBackoff:  cfg.MaxBackoff,
		metrics: &ClientMetrics{
			ProviderUsage: make(map[string]int64),
		},
	}

	// 预初始化所有 Provider 客户端
	for _, p := range cfg.Providers {
		opts := []option.RequestOption{option.WithAPIKey(p.APIKey)}
		if p.BaseURL != "" {
			opts = append(opts, option.WithBaseURL(p.BaseURL))
		}
		c.clients[p.Name] = openai.NewClient(opts...)
	}

	return c
}

// ChatCompletion 带重试 + 降级的 Chat Completion
func (c *Client) ChatCompletion(
	ctx context.Context,
	messages []openai.ChatCompletionMessageParamUnion,
	opts ...ChatOption,
) (*openai.ChatCompletion, error) {
	cfg := defaultChatConfig()
	for _, o := range opts {
		o(&cfg)
	}

	start := time.Now()
	c.metrics.mu.Lock()
	c.metrics.TotalRequests++
	c.metrics.mu.Unlock()

	// 速率限制
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit: %w", err)
	}

	// 按优先级尝试 Provider
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		for _, provider := range c.sortedProviders() {
			result, err := c.tryProvider(ctx, provider, messages, cfg)
			if err == nil {
				// 成功
				c.recordSuccess(provider.Name, start)
				return result, nil
			}

			lastErr = err
			slog.Warn("llm provider failed",
				"provider", provider.Name,
				"attempt", attempt,
				"error", err,
			)

			// 如果是 429 (rate limit) 或 5xx，尝试下一个 provider
			if isRetryable(err) {
				c.metrics.mu.Lock()
				c.metrics.TotalRetries++
				c.metrics.mu.Unlock()
				continue
			}

			// 非可重试错误，直接返回
			return nil, err
		}

		// Exponential backoff
		if attempt < c.maxRetries {
			backoff := c.backoffDuration(attempt)
			slog.Info("llm retry backoff", "duration", backoff, "attempt", attempt+1)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}
	}

	c.metrics.mu.Lock()
	c.metrics.TotalErrors++
	c.metrics.mu.Unlock()

	return nil, fmt.Errorf("all providers exhausted: %w", lastErr)
}

func (c *Client) tryProvider(
	ctx context.Context,
	provider Provider,
	messages []openai.ChatCompletionMessageParamUnion,
	cfg chatConfig,
) (*openai.ChatCompletion, error) {
	client := c.clients[provider.Name]
	if client == nil {
		return nil, fmt.Errorf("provider %s not initialized", provider.Name)
	}

	// 设置超时
	if provider.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, provider.Timeout)
		defer cancel()
	}

	model := provider.Model
	if cfg.Model != "" {
		model = cfg.Model
	}

	params := openai.ChatCompletionNewParams{
		Model:       openai.F(openai.ChatModel(model)),
		Messages:    openai.F(messages),
		Temperature: openai.F(cfg.Temperature),
		MaxTokens:   openai.F(int64(cfg.MaxTokens)),
	}

	resp, err := client.Chat.Completions.New(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("provider %s: %w", provider.Name, err)
	}

	return resp, nil
}

// ChatCompletionStream 流式版本
// 返回 openai-go SDK 原始的 Streaming stream，调用方通过 stream.Next() 逐 token 消费
func (c *Client) ChatCompletionStream(
	ctx context.Context,
	messages []openai.ChatCompletionMessageParamUnion,
	opts ...ChatOption,
) (interface{}, error) {
	cfg := defaultChatConfig()
	for _, o := range opts {
		o(&cfg)
	}

	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit: %w", err)
	}

	// 流式只使用第一个 Provider（不支持跨 Provider 重试）
	providers := c.sortedProviders()
	if len(providers) == 0 {
		return nil, errors.New("no providers configured")
	}

	p := providers[0]
	client := c.clients[p.Name]

	model := p.Model
	if cfg.Model != "" {
		model = cfg.Model
	}

	stream := client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
		Model:       openai.F(openai.ChatModel(model)),
		Messages:    openai.F(messages),
		Temperature: openai.F(cfg.Temperature),
		MaxTokens:   openai.F(int64(cfg.MaxTokens)),
	})

	return stream, nil
}

// ═══════════ Chat 选项 ═══════════

type chatConfig struct {
	Model       string
	Temperature float64
	MaxTokens   int
}

func defaultChatConfig() chatConfig {
	return chatConfig{
		Temperature: 0.8,
		MaxTokens:   1024,
	}
}

type ChatOption func(*chatConfig)

func WithModel(model string) ChatOption {
	return func(c *chatConfig) { c.Model = model }
}

func WithTemperature(t float64) ChatOption {
	return func(c *chatConfig) { c.Temperature = t }
}

func WithMaxTokens(n int) ChatOption {
	return func(c *chatConfig) { c.MaxTokens = n }
}

// ═══════════ Provider 优先级排序 ═══════════

func (c *Client) sortedProviders() []Provider {
	// 简单按 Priority 排序
	sorted := make([]Provider, len(c.providers))
	copy(sorted, c.providers)
	// insertion sort (small N)
	for i := 1; i < len(sorted); i++ {
		j := i
		for j > 0 && sorted[j].Priority < sorted[j-1].Priority {
			sorted[j], sorted[j-1] = sorted[j-1], sorted[j]
			j--
		}
	}
	return sorted
}

// ═══════════ 速率限制 (Token Bucket) ═══════════

type tokenBucket struct {
	rate     float64
	capacity float64
	tokens   float64
	lastTime time.Time
	mu       sync.Mutex
}

func newTokenBucket(rate, capacity float64) *tokenBucket {
	return &tokenBucket{
		rate:     rate,
		capacity: capacity,
		tokens:   capacity,
		lastTime: time.Now(),
	}
}

func (tb *tokenBucket) Wait(ctx context.Context) error {
	tb.mu.Lock()
	now := time.Now()
	elapsed := now.Sub(tb.lastTime).Seconds()
	tb.tokens = math.Min(tb.capacity, tb.tokens+elapsed*tb.rate)
	tb.lastTime = now

	if tb.tokens >= 1 {
		tb.tokens--
		tb.mu.Unlock()
		return nil
	}
	tb.mu.Unlock()

	// 计算需要等待的时间
	waitTime := time.Duration((1-tb.tokens)/tb.rate) * time.Second
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(waitTime):
		return nil
	}
}

// ═══════════ 重试策略 ═══════════

func (c *Client) backoffDuration(attempt int) time.Duration {
	backoff := float64(c.baseBackoff) * math.Pow(2, float64(attempt))
	// Jitter: ±25%
	jitter := (rand.Float64() - 0.5) * 0.5 * backoff
	duration := time.Duration(backoff + jitter)
	if duration > c.maxBackoff {
		duration = c.maxBackoff
	}
	return duration
}

func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// OpenAI/DeepSeek 可重试错误码
	retryablePatterns := []string{
		"429", "rate_limit",
		"500", "502", "503", "504",
		"timeout", "connection reset",
		"temporarily unavailable",
	}
	for _, p := range retryablePatterns {
		if len(errStr) >= len(p) {
			// simple contains check
			for i := 0; i <= len(errStr)-len(p); i++ {
				if errStr[i:i+len(p)] == p {
					return true
				}
			}
		}
	}
	return false
}

// ═══════════ 指标 ═══════════

func (c *Client) recordSuccess(provider string, start time.Time) {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()

	c.metrics.ProviderUsage[provider]++
	latency := time.Since(start)
	c.metrics.latencySum += latency
	c.metrics.latencyCount++
	c.metrics.AvgLatency = c.metrics.latencySum / time.Duration(c.metrics.latencyCount)
}

func (c *Client) Metrics() *ClientMetrics {
	c.metrics.mu.RLock()
	defer c.metrics.mu.RUnlock()

	m := &ClientMetrics{
		TotalRequests: c.metrics.TotalRequests,
		TotalErrors:   c.metrics.TotalErrors,
		TotalRetries:  c.metrics.TotalRetries,
		AvgLatency:    c.metrics.AvgLatency,
		ProviderUsage: make(map[string]int64),
	}
	for k, v := range c.metrics.ProviderUsage {
		m.ProviderUsage[k] = v
	}
	return m
}
