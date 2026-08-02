package health

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PeriodRecord struct {
	ID          string   `json:"id"`
	StartDate   string   `json:"start_date"`
	EndDate     *string  `json:"end_date"`
	CycleLength int      `json:"cycle_length"`
	Symptoms    []string `json:"symptoms"`
	MoodNote    string   `json:"mood_note"`
}

type BodyNote struct {
	ID        string `json:"id"`
	NoteType  string `json:"note_type"`
	Detail    string `json:"detail"`
	Severity  int    `json:"severity"`
	CreatedAt string `json:"created_at"`
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) RecordPeriod(ctx context.Context, userID, startDate string) (*PeriodRecord, error) {
	p := &PeriodRecord{
		ID:        uuid.New().String(),
		StartDate: startDate,
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO period_records (id, user_id, start_date) VALUES ($1, $2, $3)`,
		p.ID, userID, startDate,
	)
	return p, err
}

func (s *Service) GetPeriodCalendar(ctx context.Context, userID string, months int) ([]PeriodRecord, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id::text, start_date::text, end_date::text, COALESCE(cycle_length,0),
		 COALESCE(symptoms,'{}'), COALESCE(mood_note,'')
		 FROM period_records WHERE user_id=$1 ORDER BY start_date DESC LIMIT $2`,
		userID, months*2,
	)
	if err != nil { return nil, err }
	defer rows.Close()

	var records []PeriodRecord
	for rows.Next() {
		var p PeriodRecord
		rows.Scan(&p.ID, &p.StartDate, &p.EndDate, &p.CycleLength, &p.Symptoms, &p.MoodNote)
		records = append(records, p)
	}
	return records, nil
}

func (s *Service) AddBodyNote(ctx context.Context, userID, noteType, detail string, severity int) (*BodyNote, error) {
	n := &BodyNote{
		ID:        uuid.New().String(),
		NoteType:  noteType,
		Detail:    detail,
		Severity:  severity,
		CreatedAt: time.Now().Format("2006-01-02"),
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO body_notes (id, user_id, note_type, detail, severity, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		n.ID, userID, noteType, detail, severity, n.CreatedAt,
	)
	return n, err
}

func (s *Service) GetBodyNotes(ctx context.Context, userID string, limit int) ([]BodyNote, error) {
	if limit < 1 || limit > 50 { limit = 20 }
	rows, err := s.pool.Query(ctx,
		`SELECT id::text, note_type, COALESCE(detail,''), severity, created_at::text
		 FROM body_notes WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, userID, limit,
	)
	if err != nil { return nil, err }
	defer rows.Close()

	var notes []BodyNote
	for rows.Next() {
		var n BodyNote
		rows.Scan(&n.ID, &n.NoteType, &n.Detail, &n.Severity, &n.CreatedAt)
		notes = append(notes, n)
	}
	return notes, nil
}
