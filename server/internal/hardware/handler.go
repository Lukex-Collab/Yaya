// Package hardware — 实体硬件层 (ESP32 蓝牙音箱模块)
// 牙牙最核心的差异化: 她不只是在App里, 她是一个可以摸到的毛绒玩具
//
// 硬件架构:
//   ESP32-C3 (主控) + 蓝牙5.0 + 扬声器 + MEMS麦克风
//   + 电容触摸传感器(头顶) + NTC温度传感器(体温模拟)
//   + 加热片(让她是"暖暖的")
//
// 交互:
//   摸头 → 电容触摸检测 → 蓝牙上报 → App显示牙牙开心
//   对牙牙说话 → MEMS麦克风 → 蓝牙传手机 → ASR转文字 → AI回复
//   牙牙说话 → AI文本 → TTS → 蓝牙传音箱 → 从玩偶体内播放
//   抱在怀里 → NTC检测体温上升 → App显示"牙牙好暖和"
package hardware

import (
	"math/rand"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
	"github.com/lingpal/platform/pkg/realtime"
)

// SimulatedDevice 模拟硬件设备(开发/测试模式)
// 在没有真实ESP32硬件时提供完整的触觉反馈模拟
type SimulatedDevice struct {
	mu sync.RWMutex

	Touched       bool      `json:"touched"`        // 被摸了
	TouchCount    int       `json:"touch_count"`    // 今日被摸次数
	Temperature   float64   `json:"temperature"`    // 体温(°C) 36-40
	IsHeld        bool      `json:"is_held"`        // 被抱住
	HeldStartTime time.Time `json:"-"`              // 开始抱的时间
	Battery       int       `json:"battery"`        // 电量 0-100
	Volume        int       `json:"volume"`         // 音量 0-10
	IsCharging    bool      `json:"is_charging"`
	FirmwareVersion string  `json:"firmware_version"`

	// 触摸反馈
	LastTouchTime time.Time `json:"last_touch_time"`
	TouchPattern  []time.Time `json:"-"` // 用于检测摸头/拍头/长按

	wsHub *realtime.Hub
}

var GlobalDevice = &SimulatedDevice{
	Temperature:     37.2,
	Battery:         85,
	Volume:          6,
	FirmwareVersion: "v1.0.0-esp32",
	wsHub:           realtime.GlobalHub,
}

func (d *SimulatedDevice) Touch() string {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.Touched = true
	d.TouchCount++
	d.LastTouchTime = time.Now()
	d.TouchPattern = append(d.TouchPattern, time.Now())
	// 只保留最近10次触摸
	if len(d.TouchPattern) > 10 {
		d.TouchPattern = d.TouchPattern[len(d.TouchPattern)-10:]
	}

	// 体温微微上升(被摸会暖)
	d.Temperature += 0.1
	if d.Temperature > 39.0 { d.Temperature = 39.0 }

	// 检测摸头模式
	pattern := d.detectPattern()
	d.Touched = false
	return pattern
}

func (d *SimulatedDevice) detectPattern() string {
	if len(d.TouchPattern) < 2 {
		return "tap" // 单击
	}

	// 1秒内连续3次 = 拍头
	recent := d.TouchPattern
	count := 0
	now := time.Now()
	for _, t := range recent {
		if now.Sub(t) < time.Second { count++ }
	}
	if count >= 3 { return "pat_pat_pat" } // 快速拍头

	// 超过3秒 = 长按抚摸
	if len(recent) >= 2 {
		first := recent[0]
		last := recent[len(recent)-1]
		if last.Sub(first) > 3*time.Second { return "long_pet" } // 长抚摸
	}

	return "tap"
}

func (d *SimulatedDevice) Hold() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.IsHeld = true
	d.HeldStartTime = time.Now()
	d.Temperature += 0.5 // 被抱住体温上升
	if d.Temperature > 39.5 { d.Temperature = 39.5 }
}

func (d *SimulatedDevice) Release() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.IsHeld = false
	d.HeldStartTime = time.Time{}
	// 慢慢降回正常体温
	go func() {
		for d.Temperature > 37.2 {
			time.Sleep(30 * time.Second)
			d.mu.Lock()
			d.Temperature -= 0.1
			if d.Temperature < 37.2 { d.Temperature = 37.2 }
			d.mu.Unlock()
		}
	}()
}

func (d *SimulatedDevice) Status() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	heldDuration := ""
	if d.IsHeld {
		heldDuration = time.Since(d.HeldStartTime).String()
	}

	return map[string]interface{}{
		"touched":         d.Touched,
		"touch_count_today": d.TouchCount,
		"temperature":     d.Temperature,
		"is_held":         d.IsHeld,
		"held_duration":   heldDuration,
		"battery":         d.Battery,
		"volume":          d.Volume,
		"is_charging":     d.IsCharging,
		"firmware":        d.FirmwareVersion,
		"model":           "牙牙·守护版",
		"hardware":        "ESP32-C3 + BLE5.0 + 电容触摸 + NTC",
	}
}

// 模拟电池消耗(后台goroutine)
func (d *SimulatedDevice) StartBatterySimulation() {
	go func() {
		for {
			time.Sleep(time.Duration(60+rand.Intn(120)) * time.Second)
			d.mu.Lock()
			if !d.IsCharging {
				d.Battery = max(0, d.Battery-rand.Intn(2))
			} else {
				d.Battery = min(100, d.Battery+5)
			}
			d.mu.Unlock()
		}
	}()
}

// ═══════ HTTP Handler ═══════

type Handler struct{}

func NewHandler() *Handler { GlobalDevice.StartBatterySimulation(); return &Handler{} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/hardware/status", h.GetStatus)
	rg.POST("/hardware/touch", h.Touch)
	rg.POST("/hardware/hold", h.Hold)
	rg.POST("/hardware/release", h.Release)
	rg.POST("/hardware/volume", h.SetVolume)
}

func (h *Handler) GetStatus(c *gin.Context) {
	response.OK(c, GlobalDevice.Status())
}

func (h *Handler) Touch(c *gin.Context) {
	pattern := GlobalDevice.Touch()

	reactions := map[string]string{
		"tap":         "牙牙被戳了一下！她痒得咯咯笑 😆",
		"pat_pat_pat": "你连续拍了牙牙的头！她开心得转起了圈圈 🎵",
		"long_pet":    "你温柔地抚摸着牙牙...她舒服得眼睛都眯起来了 🥰",
	}

	msg := reactions[pattern]
	// WebSocket推送触摸事件
	realtime.GlobalHub.BroadcastToAll("hardware_touch", gin.H{"pattern": pattern, "message": msg})
	response.OK(c, gin.H{"pattern": pattern, "message": msg, "touch_count": GlobalDevice.TouchCount})
}

func (h *Handler) Hold(c *gin.Context) {
	GlobalDevice.Hold()
	response.OK(c, gin.H{"held": true, "message": "牙牙被你抱在怀里了...好温暖 🤗 她的体温正在慢慢上升"})
}

func (h *Handler) Release(c *gin.Context) {
	GlobalDevice.Release()
	response.OK(c, gin.H{"released": true, "message": "牙牙从你怀里下来了。不过她还在回味刚才的温暖 💕"})
}

func (h *Handler) SetVolume(c *gin.Context) {
	var req struct{ Volume int `json:"volume" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil { response.BadRequest(c, "volume required"); return }
	if req.Volume < 0 { req.Volume = 0 }
	if req.Volume > 10 { req.Volume = 10 }
	GlobalDevice.mu.Lock()
	GlobalDevice.Volume = req.Volume
	GlobalDevice.mu.Unlock()
	response.OK(c, gin.H{"volume": req.Volume})
}

func max(a, b int) int { if a > b { return a }; return b }
func min(a, b int) int { if a < b { return a }; return b }
