package search

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type SearchResult struct {
	Type    string `json:"type"` // journal/memory/message
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	Date    string `json:"date"`
}

type SearchResponse struct {
	Query   string         `json:"query"`
	Total   int            `json:"total"`
	Results []SearchResult `json:"results"`
}

func (s *Service) SearchAll(ctx context.Context, userID, query string) (*SearchResponse, error) {
	if s.pool == nil { return &SearchResponse{Query: query}, nil }
	resp := &SearchResponse{Query: query}
	like := "%" + query + "%"

	// 搜索日记
	jRows, _ := s.pool.Query(ctx,
		`SELECT id::text, COALESCE(title,'无标题'), COALESCE(content,''), created_at::text
		 FROM journals WHERE user_id=$1 AND (title ILIKE $2 OR content ILIKE $2) ORDER BY created_at DESC LIMIT 10`, userID, like)
	if jRows != nil {
		defer jRows.Close()
		for jRows.Next() {
			var r SearchResult; r.Type = "journal"
			jRows.Scan(&r.ID, &r.Title, &r.Snippet, &r.Date)
			if len(r.Snippet) > 100 { r.Snippet = r.Snippet[:100] + "..." }
			resp.Results = append(resp.Results, r)
		}
	}

	// 搜索记忆
	mRows, _ := s.pool.Query(ctx,
		`SELECT id::text, COALESCE(summary,content), content, created_at::text
		 FROM memories WHERE user_id=$1 AND (content ILIKE $2 OR summary ILIKE $2) ORDER BY created_at DESC LIMIT 10`, userID, like)
	if mRows != nil {
		defer mRows.Close()
		for mRows.Next() {
			var r SearchResult; r.Type = "memory"
			mRows.Scan(&r.ID, &r.Title, &r.Snippet, &r.Date)
			resp.Results = append(resp.Results, r)
		}
	}

	// 搜索对话
	cRows, _ := s.pool.Query(ctx,
		`SELECT c.id::text, '与牙牙的对话', m.content, m.created_at::text
		 FROM messages m JOIN conversations c ON m.conversation_id=c.id
		 WHERE c.user_id=$1 AND m.content ILIKE $2 ORDER BY m.created_at DESC LIMIT 10`, userID, like)
	if cRows != nil {
		defer cRows.Close()
		for cRows.Next() {
			var r SearchResult; r.Type = "message"
			cRows.Scan(&r.ID, &r.Title, &r.Snippet, &r.Date)
			if len(r.Snippet) > 100 { r.Snippet = r.Snippet[:100] + "..." }
			resp.Results = append(resp.Results, r)
		}
	}

	resp.Total = len(resp.Results)
	return resp, nil
}

func (s *Service) GetSuggestions(ctx context.Context, userID string) ([]string, error) {
	if s.pool == nil { return nil, nil }
	rows, _ := s.pool.Query(ctx,
		`SELECT DISTINCT LEFT(content,50) FROM journals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`, userID)
	if rows == nil { return nil, nil }
	defer rows.Close()

	var suggestions []string
	for rows.Next() {
		var title string; rows.Scan(&title)
		suggestions = append(suggestions, strings.TrimSpace(title))
	}
	return suggestions, nil
}
