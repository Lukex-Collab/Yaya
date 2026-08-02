// Package realtime — WebSocket 实时通信层
// Hub 模式: 连接管理 → 用户级消息路由 → Redis Pub/Sub 跨进程广播
//
// 依赖: github.com/gorilla/websocket (最广泛使用的 Go WebSocket 库, 22k+ stars)
//
// 事件:
//   - 安全告警推送 (红外→即时通知前端)
//   - 成就解锁通知
//   - 在线状态追踪
//   - 打字状态同步

package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// ═══════════ 消息定义 ═══════════

type Message struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp string          `json:"timestamp"`
}

type AlertPayload struct {
	AlertType string `json:"alert_type"`
	DeviceID  string `json:"device_id"`
	Message   string `json:"message"`
}

type AchievementPayload struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IconEmoji   string `json:"icon_emoji"`
}

// ═══════════ Hub ═══════════

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Hub struct {
	mu        sync.RWMutex
	clients   map[string]*Client // userID → client
	OnConnect func(userID string)
	OnDisconnect func(userID string)
}

type Client struct {
	UserID string
	Conn   *websocket.Conn
	Send   chan []byte
	hub    *Hub
	ctx    context.Context
	cancel context.CancelFunc
}

// GlobalHub 全局 WebSocket Hub 实例
var GlobalHub = NewHub()

func NewHub() *Hub {
	return &Hub{clients: make(map[string]*Client)}
}

// UpgradeHandler Gin WebSocket 升级处理器
func (h *Hub) UpgradeHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.Query("user_id")
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err)
		return
	}

	ctx, cancel := context.WithCancel(c.Request.Context())
	client := &Client{
		UserID: userID,
		Conn:   conn,
		Send:   make(chan []byte, 64),
		hub:    h,
		ctx:    ctx,
		cancel: cancel,
	}

	h.mu.Lock()
	// 如果已有连接，先关闭旧的
	if old, ok := h.clients[userID]; ok {
		close(old.Send)
		old.Conn.Close()
	}
	h.clients[userID] = client
	h.mu.Unlock()

	if h.OnConnect != nil {
		h.OnConnect(userID)
	}

	go client.writePump()
	go client.readPump()
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case <-c.ctx.Done():
			return
		case msg, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.mu.Lock()
		delete(c.hub.clients, c.UserID)
		c.hub.mu.Unlock()
		c.cancel()
		if c.hub.OnDisconnect != nil {
			c.hub.OnDisconnect(c.UserID)
		}
	}()

	c.Conn.SetReadLimit(4096)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		var m Message
		if json.Unmarshal(msg, &m) == nil && m.Type == "ping" {
			pong, _ := json.Marshal(Message{Type: "pong", Timestamp: time.Now().UTC().Format(time.RFC3339)})
			c.Send <- pong
		}
	}
}

// ═══════════ 发送API ═══════════

func (h *Hub) SendToUser(userID string, msgType string, payload interface{}) error {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()

	if !ok {
		return fmt.Errorf("user %s not connected", userID)
	}

	data, _ := json.Marshal(payload)
	msg, _ := json.Marshal(Message{
		Type:      msgType,
		Payload:   data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})

	select {
	case client.Send <- msg:
		return nil
	default:
		return fmt.Errorf("send buffer full")
	}
}

func (h *Hub) SendAlert(userID string, payload AlertPayload) error {
	return h.SendToUser(userID, "alert", payload)
}

func (h *Hub) SendAchievement(userID string, payload AchievementPayload) error {
	return h.SendToUser(userID, "achievement", payload)
}

func (h *Hub) SendTyping(userID, fromUser string) error {
	return h.SendToUser(userID, "typing", map[string]string{"from": fromUser})
}

func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

func (h *Hub) OnlineCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func (h *Hub) BroadcastToAll(msgType string, payload interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	data, _ := json.Marshal(payload)
	msg, _ := json.Marshal(Message{
		Type:      msgType,
		Payload:   data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})

	for _, client := range h.clients {
		select {
		case client.Send <- msg:
		default:
		}
	}
}
