// Package community — 牙牙社区广场
// 数百只牙牙在同一个3D空间里互动
// 用户带牙牙参加"牙牙聚会"·稀有事件引起轰动
package community

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool} }

type CommunityPet struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Species   string `json:"species"`
	Emoji     string `json:"emoji"`
	Level     int    `json:"level"`
	OwnerName string `json:"owner_name"`
	Mood      string `json:"mood"`
	Action    string `json:"action"` // 当前在做什么
	Location  string `json:"location"`
}

type PlazaEvent struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // pet_meet/achievement/rare/party
	Title       string `json:"title"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"`
	StartedAt   string `json:"started_at"`
	EndingAt    string `json:"ending_at"`
	Participants int  `json:"participants"`
}

type CommunityFeed struct {
	Events []PlazaEvent     `json:"events"`
	Online []CommunityPet   `json:"online_pets"`
	News   []NewsItem       `json:"news"`
}

type NewsItem struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Emoji   string `json:"emoji"`
	Time    string `json:"time"`
}

// GetPlaza 获取社区广场
func (s *Service) GetPlaza(ctx context.Context, userID string) (*CommunityFeed, error) {
	_ = s.pool // not needed for plaza generation
	online := s.generateOnlinePets()

	// 活跃事件
	events := []PlazaEvent{
		{ID:"ev1", Type:"party", Title:"周五牙牙聚会", Description:"每周五晚8点,带上牙牙来广场跳舞", Emoji:"🎉", StartedAt: time.Now().Format("2006-01-02")+" 20:00", EndingAt: "21:00", Participants: rand.Intn(50) + 20},
		{ID:"ev2", Type:"rare", Title:"✨ 稀有灵伴出没", Description:"一只发光的神秘灵伴在浆果森林被发现了！", Emoji:"✨", StartedAt: time.Now().Add(-1*time.Hour).Format("2006-01-02T15:04"), EndingAt: "", Participants: rand.Intn(200) + 100},
		{ID:"ev3", Type:"achievement", Title:"🏆 本周明星牙牙", Description:"小美的云狐\"棉花糖\"获得最多点赞", Emoji:"👑", StartedAt: time.Now().AddDate(0,0,-1).Format("2006-01-02"), EndingAt: "", Participants: 342},
	}

	news := []NewsItem{
		{Title:"新物种预告", Content:"下周将推出全新稀有物种「星猫」🌠", Emoji:"🌠", Time:"2小时前"},
		{Title:"社区挑战", Content:"本周目标: 全社区累积100万步！已完成78%", Emoji:"🏃", Time:"4小时前"},
		{Title:"牙牙恋爱了", Content:"两只云狐在广场上互相送了3次礼物...有情况！💕", Emoji:"💕", Time:"6小时前"},
	}

	return &CommunityFeed{Events: events, Online: online, News: news}, nil
}

// VisitFriendPet 拜访好友的灵伴
func (s *Service) VisitFriendPet(ctx context.Context, userID, friendID string) (map[string]interface{}, error) {
	visitEvent := fmt.Sprintf("来拜访了%s的家", friendID[:8])
	s.pool.Exec(ctx,
		`INSERT INTO world_visits (owner_id, visitor_id, visitor_name, visitor_emoji) VALUES ($1,$2,$3,'🧸')`,
		friendID, userID, userID[:8])

	return map[string]interface{}{
		"visited": true,
		"event":   visitEvent,
		"gift":    "💎 星光石碎片 ×1",
	}, nil
}

// SendGift 送礼物给社区好友的灵伴
func (s *Service) SendGift(ctx context.Context, userID, friendID, giftType string) (map[string]interface{}, error) {
	s.pool.Exec(ctx,
		`INSERT INTO social_feed (user_id, type, from_user_id, content) VALUES ($1,'gift',$2,$3)`,
		friendID, userID, fmt.Sprintf("送了一份%s礼物", giftType))
	return map[string]interface{}{"sent": true, "message": "🎁 礼物已送达！对方牙牙很开心～"}, nil
}

func (s *Service) generateOnlinePets() []CommunityPet {
	species := []string{"云狐","墨猫","芽龙","泡兔","岩熊"}
	emojis := []string{"🦊","🐱","🐲","🐰","🐻"}
	names := []string{"棉花糖","小黑","龙龙","跳跳","石头","奶茶","团子","皮皮","暖暖","包子"}
	actions := []string{"在晒太阳", "在追蝴蝶", "在打盹", "在跳舞", "在吃浆果", "在看风景", "在唱歌", "在玩球"}
	locations := []string{"浆果森林", "星湖", "暖阳山坡", "花园", "广场中央"}

	var pets []CommunityPet
	for i := 0; i < 12; i++ {
		si := rand.Intn(len(species))
		pets = append(pets, CommunityPet{
			ID: fmt.Sprintf("pet-%d", i+1), Name: names[rand.Intn(len(names))],
			Species: species[si], Emoji: emojis[si], Level: rand.Intn(50)+1,
			OwnerName: fmt.Sprintf("牙友%d号", rand.Intn(9000)+1000),
			Mood: "happy", Action: actions[rand.Intn(len(actions))],
			Location: locations[rand.Intn(len(locations))],
		})
	}
	return pets
}
