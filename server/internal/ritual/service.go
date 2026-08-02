package ritual

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
)

type Service struct {
	pool   *pgxpool.Pool
	client *openai.Client
}

func NewService(pool *pgxpool.Pool, deepseek *openai.Client) *Service {
	return &Service{pool: pool, client: deepseek}
}

func (s *Service) GoodMorning(ctx context.Context, userID, userName, yayaName string) (string, error) {
	if s.client == nil { return "早安呀！今天也要元气满满哦~ ☀️", nil }
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("你是" + yayaName + "，" + userName + "的宠物伙伴。现在是早晨" + time.Now().Format("15:04") + "。用温暖治愈的口吻说早安，提一下今天日期和季节感。2-3句话。"),
			openai.UserMessage("早安"),
		}),
		MaxTokens:   openai.F(int64(150)),
		Temperature: openai.F(0.9),
	})
	if err != nil || len(resp.Choices) == 0 {
		return "早安呀！今天也要元气满满哦~ ☀️", nil
	}
	return resp.Choices[0].Message.Content, nil
}

func (s *Service) GoodNight(ctx context.Context, userID, userName, yayaName string) (string, error) {
	if s.client == nil { return "晚安~ 做个好梦，我在这里守着你 🌙", nil }
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("你是" + yayaName + "，" + userName + "的宠物伙伴。现在是睡觉时间。温柔地道晚安，可以提一下今天发生的事。2-3句话。"),
			openai.UserMessage("晚安"),
		}),
		MaxTokens:   openai.F(int64(150)),
		Temperature: openai.F(0.9),
	})
	if err != nil || len(resp.Choices) == 0 {
		return "晚安~ 做个好梦，我在这里守着你 🌙", nil
	}
	return resp.Choices[0].Message.Content, nil
}

func (s *Service) BedtimeStory(ctx context.Context, yayaName string) (string, error) {
	if s.client == nil { return "从前有一只小星星...好啦，该睡了。", nil }
	resp, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.F(openai.ChatModel("deepseek-chat")),
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("你是" + yayaName + "，一只可爱的小宠物。编一个200字以内的简短暖心的睡前小故事，适合成年人听。"),
		}),
		MaxTokens:   openai.F(int64(300)),
		Temperature: openai.F(1.0),
	})
	if err != nil || len(resp.Choices) == 0 {
		return "从前有一只小星星，它每天晚上都会准时亮起来。不是因为它特别亮，是因为它答应过一只小兔子，要一直陪着她。好啦，该睡了。", nil
	}
	return resp.Choices[0].Message.Content, nil
}
