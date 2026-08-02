package world

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// 5个首发物种
var Species = []string{"云狐", "墨猫", "芽龙", "泡兔", "岩熊"}
var SpeciesEmoji = map[string]string{"云狐":"🦊","墨猫":"🐱","芽龙":"🐲","泡兔":"🐰","岩熊":"🐻"}

type PetState struct {
	ID       string `json:"id"`
	Species  string `json:"species"`
	Name     string `json:"name"`
	Emoji    string `json:"emoji"`
	Level    int    `json:"level"`
	Mood     string `json:"mood"`
	Hunger   int    `json:"hunger"`
	Gems     int    `json:"gems"`
	CurrentZone string `json:"current_zone"`
}

type Zone struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Icon        string   `json:"icon"`
	Description string   `json:"description"`
	Type        string   `json:"type"`
	NearbyPets  []string `json:"nearby_pets"`
}

type ExploreResult struct {
	ZoneName string `json:"zone_name"`
	Found    string `json:"found"`
	GemsEarned int  `json:"gems_earned"`
	Message   string `json:"message"`
}

func (s *Service) GetMyPet(ctx context.Context, userID string) (*PetState, error) {
	pet := &PetState{
		Species: Species[rand.Intn(len(Species))],
		Name:    "云狐",
		Level:   3,
		Mood:    "happy",
		Hunger:  75,
		Gems:    120,
	}

	if s.pool != nil {
		var species string
		err := s.pool.QueryRow(ctx,
			`SELECT COALESCE(species,'云狐'), COALESCE(name,'云狐'), COALESCE(level,1), COALESCE(mood,'happy'), COALESCE(hunger,100), COALESCE(gems,0)
			 FROM pet_state WHERE user_id=$1`, userID,
		).Scan(&species, &pet.Name, &pet.Level, &pet.Mood, &pet.Hunger, &pet.Gems)
		if err == nil {
			pet.Species = species
		}
	}
	pet.Emoji = SpeciesEmoji[pet.Species]
	if pet.Emoji == "" { pet.Emoji = "🦊" }
	return pet, nil
}

func (s *Service) GetZones() []Zone {
	return []Zone{
		{ID:"forest", Name:"浆果森林", Icon:"🍓", Description:"一片长满浆果的神奇森林", Type:"forest", NearbyPets:[]string{"🐱墨猫","🐰泡兔"}},
		{ID:"lake", Name:"星湖", Icon:"💧", Description:"映着星光的湖泊", Type:"water", NearbyPets:[]string{"🐲芽龙"}},
		{ID:"mountain", Name:"暖阳山坡", Icon:"☀️", Description:"阳光最好的小山坡", Type:"mountain", NearbyPets:[]string{"🐻岩熊","🦊云狐"}},
		{ID:"cave", Name:"神秘洞穴", Icon:"🕳️", Description:"藏着远古秘密的洞穴", Type:"cave", NearbyPets:[]string{}},
		{ID:"garden", Name:"春日花园", Icon:"🌸", Description:"四季如春的花园", Type:"garden", NearbyPets:[]string{"🐰泡兔","🐱墨猫"}},
	}
}

func (s *Service) ExploreZone(ctx context.Context, userID, zoneID string) (*ExploreResult, error) {
	zones := s.GetZones()
	var zoneName string
	for _, z := range zones {
		if z.ID == zoneID { zoneName = z.Name; break }
	}
	if zoneName == "" { return nil, fmt.Errorf("unknown zone: %s", zoneID) }

	// 随机探索发现
	discoveries := []string{"🍓 浆果 ×3", "💎 星光石 ×1", "🌿 魔法草 ×2", "🪙 金币 ×10", "✨ 经验水晶"}
	d := discoveries[rand.Intn(len(discoveries))]
	gems := rand.Intn(15) + 1

	if s.pool != nil {
		s.pool.Exec(ctx,
			`UPDATE pet_state SET gems = gems + $1, updated_at=now() WHERE user_id=$2`, gems, userID)
	}

	return &ExploreResult{
		ZoneName: zoneName, Found: d, GemsEarned: gems,
		Message: fmt.Sprintf("在%s探索中发现了%s！获得了%d💎", zoneName, d, gems),
	}, nil
}

func (s *Service) FeedPet(ctx context.Context, userID string) (*ExploreResult, error) {
	reactions := []string{"😋 好好吃！", "🥰 谢谢主人～", "😊 吃饱了有力气啦！", "🎵 开心地哼起了歌"}
	now := time.Now().Format("15:04")
	return &ExploreResult{
		Message: fmt.Sprintf("🍖 %s 喂食了宠物！%s", now, reactions[rand.Intn(len(reactions))]),
	}, nil
}

func (s *Service) GetNearbyPets() []map[string]string {
	return []map[string]string{
		{"name":"小墨","species":"墨猫","emoji":"🐱","level":"5"},
		{"name":"龙龙","species":"芽龙","emoji":"🐲","level":"8"},
	}
}
