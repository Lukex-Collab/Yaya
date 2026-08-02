// Package safety — BLE硬件模拟器
// 在没有真实硬件时模拟真实的设备行为：
//  - 门窗传感器定期上报状态
//  - 支持 Webhook 通知外部系统
//  - 模拟硬件断开/重连
//  - 可配置模拟场景（正常/入侵/传感器故障）
package safety

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DeviceType 设备类型
type DeviceType string

const (
	DeviceFrontDoor DeviceType = "front_door"
	DeviceWindow    DeviceType = "window"
	DeviceBalcony   DeviceType = "balcony"
	DeviceMotion    DeviceType = "motion_sensor"
)

// DeviceStatus 设备状态
type DeviceStatus string

const (
	StatusOnline     DeviceStatus = "online"
	StatusOffline    DeviceStatus = "offline"
	StatusAlert      DeviceStatus = "alert"       // 检测到异常
	StatusNormal     DeviceStatus = "normal"      // 正常关闭
	StatusBatteryLow DeviceStatus = "battery_low" // 电量低
)

// SimulatedDevice 模拟设备
type SimulatedDevice struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Type      DeviceType   `json:"type"`
	Status    DeviceStatus `json:"status"`
	Battery   int          `json:"battery"` // 0-100
	SignalRSSI int         `json:"signal_rssi"`
	LastSeen  time.Time    `json:"last_seen"`
	IsOpen    bool         `json:"is_open"` // 门窗是否打开
}

// BLESimulator BLE硬件模拟器
// 在没有真实ESP32硬件时，模拟完整的BLE设备行为
type BLESimulator struct {
	mu      sync.RWMutex
	pool    *pgxpool.Pool
	devices map[string]*SimulatedDevice
	scenarios []Scenario
	activeScenario string
	stopCh  chan struct{}
	eventCh chan DeviceEvent
}

// Scenario 模拟场景
type Scenario struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Duration    time.Duration
	Events      []ScheduledEvent
}

// ScheduledEvent 定时事件
type ScheduledEvent struct {
	After    time.Duration `json:"after_seconds"`
	DeviceID string        `json:"device_id"`
	Action   string        `json:"action"` // open/close/alert/offline/reconnect
}

// DeviceEvent 设备事件（WebSocket推送用）
type DeviceEvent struct {
	DeviceID  string       `json:"device_id"`
	DeviceName string      `json:"device_name"`
	Type      DeviceType   `json:"type"`
	Action    string       `json:"action"`
	Status    DeviceStatus `json:"status"`
	Timestamp time.Time    `json:"timestamp"`
	Message   string       `json:"message"`
}

// NewBLESimulator 创建模拟器
func NewBLESimulator(pool *pgxpool.Pool) *BLESimulator {
	sim := &BLESimulator{
		pool:    pool,
		devices: makeDefaultDevices(),
		scenarios: defaultScenarios(),
		stopCh:  make(chan struct{}),
		eventCh: make(chan DeviceEvent, 100),
	}

	return sim
}

// makeDefaultDevices 创建默认设备列表
func makeDefaultDevices() map[string]*SimulatedDevice {
	return map[string]*SimulatedDevice{
		"dev_001": {ID: "dev_001", Name: "前门传感器", Type: DeviceFrontDoor, Status: StatusNormal, Battery: 85, SignalRSSI: -45, IsOpen: false},
		"dev_002": {ID: "dev_002", Name: "窗户传感器", Type: DeviceWindow, Status: StatusNormal, Battery: 72, SignalRSSI: -52, IsOpen: false},
		"dev_003": {ID: "dev_003", Name: "阳台传感器", Type: DeviceBalcony, Status: StatusNormal, Battery: 60, SignalRSSI: -58, IsOpen: false},
		"dev_004": {ID: "dev_004", Name: "移动探测器", Type: DeviceMotion, Status: StatusNormal, Battery: 90, SignalRSSI: -40, IsOpen: false},
	}
}

// defaultScenarios 模拟场景列表
func defaultScenarios() []Scenario {
	return []Scenario{
		{
			Name: "normal_day", Description: "普通的一天 - 一切安全",
			Duration: 5 * time.Minute,
			Events: []ScheduledEvent{
				{After: 30 * time.Second, DeviceID: "dev_001", Action: "open"},
				{After: 35 * time.Second, DeviceID: "dev_001", Action: "close"},
				{After: 60 * time.Second, DeviceID: "dev_002", Action: "open"},
				{After: 65 * time.Second, DeviceID: "dev_002", Action: "close"},
			},
		},
		{
			Name: "intrusion_test", Description: "入侵测试 - 模拟非法开门",
			Duration: 2 * time.Minute,
			Events: []ScheduledEvent{
				{After: 10 * time.Second, DeviceID: "dev_001", Action: "open"},
				{After: 11 * time.Second, DeviceID: "dev_001", Action: "alert"},
				{After: 20 * time.Second, DeviceID: "dev_001", Action: "close"},
			},
		},
		{
			Name: "sensor_failure", Description: "传感器故障 - 设备离线",
			Duration: 3 * time.Minute,
			Events: []ScheduledEvent{
				{After: 15 * time.Second, DeviceID: "dev_003", Action: "offline"},
				{After: 45 * time.Second, DeviceID: "dev_003", Action: "reconnect"},
				{After: 60 * time.Second, DeviceID: "dev_004", Action: "battery_low"},
			},
		},
	}
}

// Start 启动模拟器（在goroutine中运行）
func (s *BLESimulator) Start(ctx context.Context) {
	slog.Info("BLE simulator started with 4 virtual devices")
	go s.heartbeat(ctx)
	go s.randomEvents(ctx)
}

// Stop 停止模拟器
func (s *BLESimulator) Stop() {
	close(s.stopCh)
	slog.Info("BLE simulator stopped")
}

// StartScenario 启动指定场景
func (s *BLESimulator) StartScenario(ctx context.Context, name string) error {
	var scenario *Scenario
	for _, sc := range s.scenarios {
		if sc.Name == name {
			scenario = &sc
			break
		}
	}
	if scenario == nil {
		return fmt.Errorf("unknown scenario: %s (available: normal_day, intrusion_test, sensor_failure)", name)
	}

	s.mu.Lock()
	s.activeScenario = name
	s.mu.Unlock()

	slog.Info("BLE scenario started", "name", name, "duration", scenario.Duration)

	// 在goroutine中按时间线执行事件
	go func() {
		for _, event := range scenario.Events {
			select {
			case <-ctx.Done():
				return
			case <-time.After(event.After):
				s.triggerEvent(event.DeviceID, event.Action)
			}
		}

		s.mu.Lock()
		s.activeScenario = ""
		s.mu.Unlock()
	}()

	return nil
}

// triggerEvent 触发设备事件
func (s *BLESimulator) triggerEvent(deviceID, action string) {
	s.mu.Lock()
	dev, ok := s.devices[deviceID]
	if !ok {
		s.mu.Unlock()
		return
	}

	switch action {
	case "open":
		dev.IsOpen = true
		dev.LastSeen = time.Now()
	case "close":
		dev.IsOpen = false
		dev.LastSeen = time.Now()
	case "alert":
		dev.Status = StatusAlert
		dev.LastSeen = time.Now()
	case "offline":
		dev.Status = StatusOffline
	case "reconnect":
		dev.Status = StatusNormal
		dev.LastSeen = time.Now()
	case "battery_low":
		dev.Status = StatusBatteryLow
		dev.Battery = 15
	}

	event := DeviceEvent{
		DeviceID:   deviceID,
		DeviceName: dev.Name,
		Type:       dev.Type,
		Action:     action,
		Status:     dev.Status,
		Timestamp:  time.Now(),
		Message:    buildAlertMessage(dev, action),
	}
	s.mu.Unlock()

	// 推送到事件通道
	select {
	case s.eventCh <- event:
	default:
	}

	// 记录到数据库
	if s.pool != nil {
		s.pool.Exec(context.Background(),
			`INSERT INTO safety_logs (user_id, event_type, device_id, detail, is_simulated)
			 VALUES ($1, $2, $3, $4, true)`,
			"demo_user", action, deviceID, event.Message,
		)
	}

	slog.Info("BLE event", "device", deviceID, "action", action, "msg", event.Message)
}

// heartbeat 心跳——定期更新设备状态
func (s *BLESimulator) heartbeat(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.mu.Lock()
			for _, dev := range s.devices {
				if dev.Status == StatusOffline {
					continue
				}
				dev.LastSeen = time.Now()
				// 模拟电池缓慢下降
				dev.Battery = max(0, dev.Battery-rand.Intn(2))
				if dev.Battery < 20 {
					dev.Status = StatusBatteryLow
				}
				// 模拟信号波动
				dev.SignalRSSI = -40 - rand.Intn(30)
			}
			s.mu.Unlock()
		}
	}
}

// randomEvents 随机事件（模拟真实环境中的传感器误报）
func (s *BLESimulator) randomEvents(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(120+rand.Intn(180)) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
			return
		case <-ticker.C:
			// 5% 概率触发随机事件
			if rand.Float64() < 0.05 {
				s.mu.RLock()
				devices := make([]string, 0, len(s.devices))
				for id := range s.devices {
					devices = append(devices, id)
				}
				s.mu.RUnlock()

				if len(devices) == 0 {
					continue
				}
				id := devices[rand.Intn(len(devices))]
				actions := []string{"open", "close"}
				s.triggerEvent(id, actions[rand.Intn(len(actions))])
			}
			ticker.Reset(time.Duration(120+rand.Intn(180)) * time.Second)
		}
	}
}

// ═══════════ 查询接口 ═══════════

// GetDevices 获取所有设备状态
func (s *BLESimulator) GetDevices() map[string]*SimulatedDevice {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 返回副本
	devices := make(map[string]*SimulatedDevice, len(s.devices))
	for k, v := range s.devices {
		dev := *v
		devices[k] = &dev
	}
	return devices
}

// GetDevice 获取单个设备
func (s *BLESimulator) GetDevice(id string) (*SimulatedDevice, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	dev, ok := s.devices[id]
	if !ok {
		return nil, fmt.Errorf("device %s not found", id)
	}
	cp := *dev
	return &cp, nil
}

// IsAllSafe 检查所有门窗是否安全
func (s *BLESimulator) IsAllSafe() (bool, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, dev := range s.devices {
		if dev.Status == StatusAlert {
			return false, fmt.Sprintf("%s检测到入侵！", dev.Name)
		}
		if dev.IsOpen && dev.Type != DeviceMotion {
			return false, fmt.Sprintf("%s未关闭", dev.Name)
		}
		if dev.Status == StatusOffline {
			return false, fmt.Sprintf("%s已离线", dev.Name)
		}
	}
	return true, "所有传感器状态正常"
}

// GetActiveScenario 获取当前活跃场景
func (s *BLESimulator) GetActiveScenario() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.activeScenario == "" {
		return "none"
	}
	return s.activeScenario
}

// EventChannel 获取事件通道（供WebSocket广播）
func (s *BLESimulator) EventChannel() <-chan DeviceEvent {
	return s.eventCh
}

// ═══════════ 辅助 ═══════════

func buildAlertMessage(dev *SimulatedDevice, action string) string {
	switch action {
	case "open":
		if dev.Type == DeviceFrontDoor || dev.Type == DeviceBalcony {
			return fmt.Sprintf("⚠️ %s被打开了！请检查是否有人进入", dev.Name)
		}
		return fmt.Sprintf("⚠️ %s被打开", dev.Name)
	case "alert":
		return fmt.Sprintf("🚨 %s检测到异常！建议立即查看", dev.Name)
	case "offline":
		return fmt.Sprintf("⚠️ %s已离线，请检查电池和连接", dev.Name)
	case "reconnect":
		return fmt.Sprintf("✅ %s已重新连接", dev.Name)
	case "battery_low":
		return fmt.Sprintf("🔋 %s电量低(%d%%)，请更换电池", dev.Name, dev.Battery)
	case "close":
		return fmt.Sprintf("✅ %s已关闭", dev.Name)
	default:
		return fmt.Sprintf("%s: %s", dev.Name, action)
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
