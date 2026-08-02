package safety

import (
	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

type Handler struct { svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/safety/status", h.GetStatus)
	rg.GET("/safety/history", h.GetHistory)
	rg.GET("/safety/devices", h.GetDevices)
	rg.GET("/safety/door-check", h.DoorCheck)
	rg.POST("/safety/alert/test", h.TestAlert)
	rg.POST("/safety/scenario/:name", h.RunScenario)
	rg.GET("/safety/scenario/active", h.GetActiveScenario)
}

// GetStatus 当前安全状态（模拟模式: always safe）
func (h *Handler) GetStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	status, err := h.svc.GetStatus(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, status)
}

// GetHistory 安全事件日志
func (h *Handler) GetHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	logs, err := h.svc.GetHistory(c.Request.Context(), userID, 20)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, logs)
}

// DoorCheck 门窗检测
func (h *Handler) DoorCheck(c *gin.Context) {
	response.OK(c, gin.H{
		"front_door": "closed",
		"window":     "closed",
		"mode":       "simulated",
		"checked_at": "now",
	})
}

// TestAlert 触发测试告警（开发调试用）
func (h *Handler) TestAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	err := h.svc.RecordAlert(c.Request.Context(), userID, "test_alert", "test_device", map[string]interface{}{
		"message": "这是一条测试告警",
	})
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{"alert_sent": true, "msg": "测试告警已记录"})
}

// GetDevices 获取所有BLE设备状态
func (h *Handler) GetDevices(c *gin.Context) {
	sim := h.svc.GetSimulator()
	devices := sim.GetDevices()
	allSafe, safetyMsg := sim.IsAllSafe()

	deviceList := make([]gin.H, 0)
	for _, dev := range devices {
		deviceList = append(deviceList, gin.H{
			"id": dev.ID, "name": dev.Name, "type": dev.Type,
			"status": dev.Status, "battery": dev.Battery,
			"signal_rssi": dev.SignalRSSI, "is_open": dev.IsOpen,
			"last_seen": dev.LastSeen.Format("2006-01-02T15:04:05Z"),
		})
	}
	response.OK(c, gin.H{
		"all_safe":       allSafe,
		"safety_message": safetyMsg,
		"active_scenario": h.svc.GetSimulator().GetActiveScenario(),
		"devices":        deviceList,
	})
}

// RunScenario 运行模拟场景（入侵测试/传感器故障/正常模式）
func (h *Handler) RunScenario(c *gin.Context) {
	name := c.Param("name")
	if err := h.svc.RunScenario(c.Request.Context(), name); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, gin.H{
		"scenario_started": name,
		"msg":              "场景已启动，设备事件将通过WebSocket推送",
	})
}

// GetActiveScenario 获取当前活跃场景
func (h *Handler) GetActiveScenario(c *gin.Context) {
	response.OK(c, gin.H{
		"active_scenario": h.svc.GetSimulator().GetActiveScenario(),
	})
}
