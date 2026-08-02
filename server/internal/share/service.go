package share

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Service struct{}

func NewService() *Service { return &Service{} }

type ShareCard struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	ImageURL  string `json:"image_url"`
	SharedURL string `json:"shared_url"`
	CreatedAt string `json:"created_at"`
}

func (s *Service) GenerateJournalCard(ctx context.Context, userID, journalID string) (*ShareCard, error) {
	card := &ShareCard{
		ID: uuid.New().String(), Type: "journal",
		Title: "牙牙的手账日记", ImageURL: fmt.Sprintf("/share-cards/%s.png", journalID),
		SharedURL: fmt.Sprintf("https://lingpal.com/share/journal/%s", journalID),
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	return card, nil
}

func (s *Service) GenerateAchievementCard(ctx context.Context, userID, code string) (*ShareCard, error) {
	return &ShareCard{
		ID: uuid.New().String(), Type: "achievement",
		Title: "🏆 解锁新成就！",
		ImageURL: fmt.Sprintf("/share-cards/achievement-%s.png", code),
		SharedURL: fmt.Sprintf("https://lingpal.com/share/achievement/%s", code),
		CreatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *Service) GenerateEmotionReportCard(ctx context.Context, userID string) (*ShareCard, error) {
	return &ShareCard{
		ID: uuid.New().String(), Type: "emotion_report",
		Title: "📊 本月情绪报告", ImageURL: fmt.Sprintf("/share-cards/emotion-%s.png", userID),
		SharedURL: fmt.Sprintf("https://lingpal.com/share/emotion/%s", userID),
		CreatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *Service) GetMyCards(ctx context.Context, userID string) ([]ShareCard, error) {
	return nil, nil
}
