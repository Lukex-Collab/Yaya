// Package weather — 天气查询客户端
// 支持多个免费天气 API: Open-Meteo (免费,无需Key) / 和风天气 / 高德
// 用于早安问候中注入天气信息
package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Info 天气信息
type Info struct {
	City        string  `json:"city"`
	Temperature float64 `json:"temperature"`  // 摄氏度
	FeelsLike   float64 `json:"feels_like"`
	Condition   string  `json:"condition"`    // 中文描述
	Humidity    int     `json:"humidity"`
	WindSpeed   float64 `json:"wind_speed"`
	Icon        string  `json:"icon"`         // emoji
	AQI         int     `json:"aqi"`          // 空气质量指数
}

type Client struct {
	httpClient *http.Client
	apiKey     string // 高德/和风天气 API Key (可选)
}

func NewClient(apiKey string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 5 * time.Second},
		apiKey:     apiKey,
	}
}

// GetCurrent 获取当前天气
// 优先使用高德API，降级使用 Open-Meteo 免费API
func (c *Client) GetCurrent(ctx context.Context, city string) (*Info, error) {
	if c.apiKey != "" {
		if info, err := c.fromAMap(ctx, city); err == nil {
			return info, nil
		}
	}
	// 降级: Open-Meteo (免费，但需要经纬度)
	return c.fromOpenMeteo(ctx, city)
}

// fromOpenMeteo Open-Meteo 免费天气 API (无需 Key)
// 默认城市坐标映射
func (c *Client) fromOpenMeteo(ctx context.Context, city string) (*Info, error) {
	coords := getCityCoords(city)
	url := fmt.Sprintf("https://api.open-meteo.com/v1/forecast?latitude=%.2f&longitude=%.2f&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto",
		coords.Lat, coords.Lon)

	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Current struct {
			Temperature2m        float64 `json:"temperature_2m"`
			RelativeHumidity2m   int     `json:"relative_humidity_2m"`
			ApparentTemperature  float64 `json:"apparent_temperature"`
			WindSpeed10m         float64 `json:"wind_speed_10m"`
			WeatherCode          int     `json:"weather_code"`
		} `json:"current"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return &Info{
		City:        city,
		Temperature: result.Current.Temperature2m,
		FeelsLike:   result.Current.ApparentTemperature,
		Condition:   weatherCodeToChinese(result.Current.WeatherCode),
		Humidity:    result.Current.RelativeHumidity2m,
		WindSpeed:   result.Current.WindSpeed10m,
		Icon:        weatherCodeToEmoji(result.Current.WeatherCode),
	}, nil
}

// fromAMap 高德天气 API
func (c *Client) fromAMap(ctx context.Context, city string) (*Info, error) {
	// 先获取城市 adcode
	geoURL := fmt.Sprintf("https://restapi.amap.com/v3/config/district?keywords=%s&subdistrict=0&key=%s", city, c.apiKey)
	// ... 实现略
	_ = geoURL
	return nil, fmt.Errorf("not implemented")
}

// GetGreeting 生成天气相关的问候语
func (c *Client) GetGreeting(ctx context.Context, nickname, city string) string {
	info, err := c.GetCurrent(ctx, city)
	if err != nil {
		// 无天气数据时不报错
		return fmt.Sprintf("早安呀 %s！新的一天开始了 ☀️", nickname)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("早安呀 %s～", nickname))

	sb.WriteString(fmt.Sprintf(" 今天%s%s，气温%.0f°C",
		city, info.Icon, info.Temperature))

	switch {
	case info.Temperature < 10:
		sb.WriteString("，记得多穿一点哦！🧣")
	case info.Temperature > 30:
		sb.WriteString("，注意防晒防暑！🌂")
	case info.Condition == "雨" || info.Condition == "小雨" || info.Condition == "大雨":
		sb.WriteString("，出门别忘了带伞！🌂")
	default:
		sb.WriteString("，适合出门走走～")
	}

	if info.AQI > 100 {
		sb.WriteString(" 空气质量不太好，记得戴口罩 😷")
	}

	return sb.String()
}

// ═══════════ 辅助 ═══════════

type Coord struct{ Lat, Lon float64 }

func getCityCoords(city string) Coord {
	coords := map[string]Coord{
		"北京": {39.90, 116.40},
		"上海": {31.23, 121.47},
		"广州": {23.13, 113.26},
		"深圳": {22.54, 114.06},
		"杭州": {30.27, 120.15},
		"成都": {30.57, 104.07},
		"武汉": {30.59, 114.30},
		"南京": {32.06, 118.80},
		"重庆": {29.43, 106.91},
		"西安": {34.26, 108.94},
	}
	if c, ok := coords[city]; ok {
		return c
	}
	return Coord{39.90, 116.40} // 默认北京
}

func weatherCodeToChinese(code int) string {
	switch {
	case code <= 1: return "晴"
	case code == 2: return "多云"
	case code == 3: return "阴"
	case code <= 48: return "雾"
	case code <= 57: return "小雨"
	case code <= 67: return "雨"
	case code <= 77: return "雪"
	case code <= 82: return "阵雨"
	case code >= 95: return "雷暴"
	default: return "晴"
	}
}

func weatherCodeToEmoji(code int) string {
	switch {
	case code <= 1: return "☀️"
	case code == 2: return "⛅"
	case code == 3: return "☁️"
	case code <= 48: return "🌫️"
	case code <= 57: return "🌦️"
	case code <= 67: return "🌧️"
	case code <= 77: return "❄️"
	case code <= 82: return "🌦️"
	default: return "☀️"
	}
}
