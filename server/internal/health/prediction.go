package health

import (
	"math"
	"sort"
	"time"
)

// ═══════════ 经期预测引擎 ═══════════
// 算法：加权平均周期法
// - 收集用户所有历史周期长度
// - 最近6次周期的权重更高（×1.5）
// - 排除异常值（< 21天 或 > 40天 的周期）
// - 返回：预测下次经期日期、排卵期窗口、置信度

// PeriodPrediction 预测结果
type PeriodPrediction struct {
	NextPeriodDate   string  `json:"next_period_date"`   // 预测下次经期开始日期 (YYYY-MM-DD)
	OvulationDate    string  `json:"ovulation_date"`     // 预测排卵日
	FertileWindow    [2]string `json:"fertile_window"`   // 易孕期窗口 [start, end]
	PredictedCycle   int     `json:"predicted_cycle"`    // 预测周期天数
	Confidence       float64 `json:"confidence"`         // 置信度 0-1
	CurrentDay       int     `json:"current_day"`        // 当前周期第几天
	DaysUntilNext    int     `json:"days_until_next"`    // 距下次经期天数
	CurrentPhase     string  `json:"current_phase"`      // 当前阶段: menstrual/follicular/ovulation/luteal
}

// PredictNext 预测下次经期
func PredictNext(records []PeriodRecord) *PeriodPrediction {
	p := &PeriodPrediction{
		PredictedCycle: 28, // 默认28天
		Confidence:     0.3,
	}

	if len(records) < 1 {
		return p
	}

	// 1. 排序（从旧到新）
	sorted := make([]PeriodRecord, len(records))
	copy(sorted, records)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].StartDate < sorted[j].StartDate
	})

	lastRecord := sorted[len(sorted)-1]
	lastStart, _ := time.Parse("2006-01-02", lastRecord.StartDate)

	// 2. 计算当前周期第几天
	p.CurrentDay = int(time.Since(lastStart).Hours() / 24)
	if p.CurrentDay < 0 {
		p.CurrentDay = 0
	}

	// 3. 计算周期长度列表
	var cycles []int
	for i := 1; i < len(sorted); i++ {
		prev, _ := time.Parse("2006-01-02", sorted[i-1].StartDate)
		curr, _ := time.Parse("2006-01-02", sorted[i].StartDate)
		diff := int(curr.Sub(prev).Hours() / 24)

		// 排除异常值
		if diff >= 21 && diff <= 40 {
			cycles = append(cycles, diff)
		}
	}

	// 4. 加权平均
	if len(cycles) > 0 {
		totalWeight := 0.0
		weightedSum := 0.0

		for i, c := range cycles {
			weight := 1.0
			// 最近 6 次权重加倍
			if i >= len(cycles)-6 {
				weight = 1.5
			}
			weightedSum += float64(c) * weight
			totalWeight += weight
		}

		p.PredictedCycle = int(math.Round(weightedSum / totalWeight))

		// 置信度：数据越多越准确
		if len(cycles) >= 1 {
			p.Confidence = math.Min(0.95, 0.3+float64(len(cycles))*0.08)
		}
	}

	// 5. 计算预测日期
	p.NextPeriodDate = lastStart.AddDate(0, 0, p.PredictedCycle).Format("2006-01-02")
	p.DaysUntilNext = p.PredictedCycle - p.CurrentDay
	if p.DaysUntilNext < 0 {
		// 可能已经过了预测日期，重新计算
		nextStart := lastStart.AddDate(0, 0, p.PredictedCycle)
		daysSinceNext := int(time.Since(nextStart).Hours() / 24)
		if daysSinceNext > 0 && daysSinceNext < 7 {
			// 可能略有延迟，使用当前周期+7天保守估计
			p.DaysUntilNext = 0
			p.NextPeriodDate = time.Now().AddDate(0, 0, 3).Format("2006-01-02")
		} else {
			p.DaysUntilNext = p.PredictedCycle - (daysSinceNext)
		}
	}

	// 6. 排卵日 = 下次经期 - 14天
	nextPeriodDate, _ := time.Parse("2006-01-02", p.NextPeriodDate)
	ovulationDate := nextPeriodDate.AddDate(0, 0, -14)
	p.OvulationDate = ovulationDate.Format("2006-01-02")

	// 7. 易孕期 = 排卵日前5天到后1天
	p.FertileWindow = [2]string{
		ovulationDate.AddDate(0, 0, -5).Format("2006-01-02"),
		ovulationDate.AddDate(0, 0, 1).Format("2006-01-02"),
	}

	// 8. 当前阶段判断
	p.CurrentPhase = determinePhase(p.CurrentDay, p.PredictedCycle)

	return p
}

// determinePhase 根据周期天数判断当前阶段
func determinePhase(currentDay, cycleLength int) string {
	phaseLength := float64(cycleLength)

	// 阶段比例（基于标准28天周期）
	// 月经期: day 1-5 (0-18%)
	// 卵泡期: day 6-13 (19-46%)
	// 排卵期: day 14-15 (47-54%)
	// 黄体期: day 16-28 (55-100%)
	progress := float64(currentDay) / phaseLength

	switch {
	case progress >= 0 && progress < 0.18:
		return "menstrual"
	case progress >= 0.18 && progress < 0.46:
		return "follicular"
	case progress >= 0.46 && progress < 0.54:
		return "ovulation"
	default:
		return "luteal"
	}
}

// PhaseDescription 阶段中文描述
func PhaseDescription(phase string) string {
	switch phase {
	case "menstrual":
		return "经期"
	case "follicular":
		return "卵泡期"
	case "ovulation":
		return "排卵期"
	case "luteal":
		return "黄体期"
	default:
		return "未知"
	}
}

// PhaseCareTip 阶段关怀建议
func PhaseCareTip(phase string) string {
	switch phase {
	case "menstrual":
		return "记得保暖，多喝热水，牙牙会一直陪着你 🩷"
	case "follicular":
		return "精力满满的时期！适合运动和社交 💪"
	case "ovulation":
		return "状态最好的时候，去做你想做的事吧 ✨"
	case "luteal":
		return "可能会有些情绪波动，没关系，和牙牙聊聊 🌸"
	default:
		return ""
	}
}

// ═══════════ 健康打卡统计 ═══════════

// DailyCheckStats 打卡统计
type DailyCheckStats struct {
	SleepStreak    int `json:"sleep_streak"`
	WaterStreak    int `json:"water_streak"`
	ExerciseStreak int `json:"exercise_streak"`
	MoodStreak     int `json:"mood_streak"`
	TotalDays      int `json:"total_days"`
	CompletionRate float64 `json:"completion_rate"`
}

func GetDailyCheckStats(notes []BodyNote) *DailyCheckStats {
	stats := &DailyCheckStats{}
	if len(notes) == 0 {
		return stats
	}

	// 按类型分组统计
	typeCounts := make(map[string]int)
	for _, n := range notes {
		typeCounts[n.NoteType]++
	}

	stats.SleepStreak = typeCounts["sleep"]
	stats.WaterStreak = typeCounts["water"]
	stats.ExerciseStreak = typeCounts["exercise"]
	stats.MoodStreak = typeCounts["mood"]

	// 计算最近连续打卡天数
	stats.TotalDays = len(notes)
	if stats.TotalDays > 0 {
		stats.CompletionRate = math.Min(1.0, float64(stats.TotalDays)/30.0)
	}

	return stats
}
