package health

import (
	"testing"
	"time"
)

func TestPredictNext_NoRecords(t *testing.T) {
	p := PredictNext([]PeriodRecord{})
	if p.Confidence >= 0.5 {
		t.Error("confidence should be low with no records")
	}
	if p.PredictedCycle != 28 {
		t.Errorf("default cycle should be 28, got %d", p.PredictedCycle)
	}
}

func TestPredictNext_SingleRecord(t *testing.T) {
	records := []PeriodRecord{
		{StartDate: time.Now().AddDate(0, 0, -10).Format("2006-01-02")},
	}
	p := PredictNext(records)
	if p.CurrentDay < 9 || p.CurrentDay > 11 {
		t.Errorf("current day should be ~10, got %d", p.CurrentDay)
	}
}

func TestPredictNext_StableCycle(t *testing.T) {
	// 模拟4个月的稳定28天周期
	now := time.Now()
	records := []PeriodRecord{
		{StartDate: now.AddDate(0, 0, -28*4).Format("2006-01-02")},
		{StartDate: now.AddDate(0, 0, -28*3).Format("2006-01-02")},
		{StartDate: now.AddDate(0, 0, -28*2).Format("2006-01-02")},
		{StartDate: now.AddDate(0, 0, -28).Format("2006-01-02")},
	}

	p := PredictNext(records)
	if p.PredictedCycle != 28 {
		t.Errorf("predicted cycle should be 28, got %d", p.PredictedCycle)
	}
	if p.Confidence < 0.4 {
		t.Errorf("confidence should be >= 0.4 with 3 cycles, got %.2f", p.Confidence)
	}
}

func TestPredictNext_VariableCycle(t *testing.T) {
	now := time.Now()
	records := []PeriodRecord{
		{StartDate: now.AddDate(0, 0, -90).Format("2006-01-02")}, // 30天前
		{StartDate: now.AddDate(0, 0, -60).Format("2006-01-02")}, // 30天
		{StartDate: now.AddDate(0, 0, -32).Format("2006-01-02")}, // 28天
	}

	p := PredictNext(records)
	if p.PredictedCycle < 27 || p.PredictedCycle > 31 {
		t.Errorf("weighted cycle should be near 29, got %d", p.PredictedCycle)
	}
}

func TestDeterminePhase(t *testing.T) {
	tests := []struct{ day, cycle int; phase string }{
		{1, 28, "menstrual"},
		{3, 28, "menstrual"},
		{8, 28, "follicular"},
		{14, 28, "ovulation"},
		{20, 28, "luteal"},
		{26, 28, "luteal"},
	}

	for _, tt := range tests {
		phase := determinePhase(tt.day, tt.cycle)
		if phase != tt.phase {
			t.Errorf("day %d of %d-day cycle: got %s, want %s", tt.day, tt.cycle, phase, tt.phase)
		}
	}
}

func TestPhaseCareTip(t *testing.T) {
	for _, phase := range []string{"menstrual", "follicular", "ovulation", "luteal"} {
		tip := PhaseCareTip(phase)
		if tip == "" {
			t.Errorf("phase %s should have a care tip", phase)
		}
	}
}

func TestPredictNext_AnomalyExclusion(t *testing.T) {
	// 异常周期（<21天或>40天）应被排除
	now := time.Now()
	records := []PeriodRecord{
		{StartDate: now.AddDate(0, 0, -70).Format("2006-01-02")}, // 最早记录
		{StartDate: now.AddDate(0, 0, -55).Format("2006-01-02")}, // 15天间隔 → <21 异常，应排除
		{StartDate: now.AddDate(0, 0, -28).Format("2006-01-02")}, // 27天间隔 → 正常
	}

	p := PredictNext(records)
	// 排除了15天异常后，唯一有效周期是27，预测应该接近27
	if p.PredictedCycle != 27 {
		t.Errorf("after excluding 15-day anomaly, expected cycle=27, got %d", p.PredictedCycle)
	}
}

func BenchmarkPredictNext(b *testing.B) {
	now := time.Now()
	records := make([]PeriodRecord, 12)
	for i := 0; i < 12; i++ {
		records[i] = PeriodRecord{
			StartDate: now.AddDate(0, -i, 0).Format("2006-01-02"),
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		PredictNext(records)
	}
}
