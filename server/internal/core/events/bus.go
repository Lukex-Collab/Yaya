package events

import (
	"context"
	"encoding/json"

	"github.com/redis/go-redis/v9"
)

// ChatCompleted 对话完成事件
type ChatCompleted struct {
	UserID   string `json:"user_id"`
	ConvID   string `json:"conv_id"`
	UserMsg  string `json:"user_msg"`
	BotReply string `json:"bot_reply"`
}

// Bus 事件总线
type Bus struct {
	rdb *redis.Client
}

func NewBus(rdb *redis.Client) *Bus {
	return &Bus{rdb: rdb}
}

// Publish 发布事件到 channel
func (b *Bus) Publish(ctx context.Context, channel string, event interface{}) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return b.rdb.Publish(ctx, channel, data).Err()
}

// Subscribe 订阅 channel，返回消息 channel
func (b *Bus) Subscribe(ctx context.Context, channel string) (<-chan *redis.Message, <-chan error) {
	msgCh := make(chan *redis.Message, 100)
	errCh := make(chan error, 1)

	pubsub := b.rdb.Subscribe(ctx, channel)

	go func() {
		defer pubsub.Close()
		defer close(msgCh)
		defer close(errCh)

		// 等待订阅确认
		_, err := pubsub.Receive(ctx)
		if err != nil {
			errCh <- err
			return
		}

		ch := pubsub.Channel()
		for msg := range ch {
			select {
			case msgCh <- msg:
			case <-ctx.Done():
				return
			}
		}
	}()

	return msgCh, errCh
}

const (
	ChannelChatCompleted = "chat:completed"
)
