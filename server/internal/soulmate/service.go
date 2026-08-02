package soulmate

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// 灵魂伴侣系统 — 让两只牙牙交朋友
//
// 配对流程:
//   1) 小美打开配对 → 生成6位配对码
//   2) 闺蜜输入配对码 → 两只牙牙"认识"了
//   3) 牙牙A去牙牙B家串门→留言→送礼
//   4) 小美和闺蜜聊天时,可以看到"牙牙们的对话"
//
// 裂变系数:
//   1个用户 → 至少带动1个闺蜜购买牙牙
//   聚会4人配对 → 牙牙的社交圈 = 4倍传播

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// SoulmatePair 灵魂伴侣配对
type SoulmatePair struct {
	ID          string `json:"id"`
	MyYayaName  string `json:"my_yaya_name"`
	MyYayaEmoji string `json:"my_yaya_emoji"`
	PairName    string `json:"pair_name"`          // 闺蜜昵称
	PairYayaName string `json:"pair_yaya_name"`
	PairYayaEmoji string `json:"pair_yaya_emoji"`
	PairedAt    string `json:"paired_at"`
	YayaBond    string `json:"yaya_bond"`          // 两只牙牙的关系: best_friends / crush / sisters
}

// YayaMessage 牙牙之间的互动消息
type YayaMessage struct {
	ID        string `json:"id"`
	FromYaya  string `json:"from_yaya"`
	ToYaya    string `json:"to_yaya"`
	Emoji     string `json:"emoji"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
}

// MutualMoment 共同回忆
type MutualMoment struct {
	Date       string `json:"date"`
	Type       string `json:"type"`
	Title      string `json:"title"`
	Emoji      string `json:"emoji"`
	MyNote     string `json:"my_note"`
	FriendNote string `json:"friend_note,omitempty"`
}

func (s *Service) PairSoulmates(ctx context.Context, userID, pairCode string) (map[string]interface{}, error) {
	// 验证配对码
	var pairUserID, pairNickname, pairYaya, pairSpecies string
	err := s.pool.QueryRow(ctx,
		`SELECT u.id::text, u.nickname, COALESCE(u.yaya_nickname,'牙牙'), COALESCE(ps.species,'云狐')
		 FROM users u JOIN pair_codes pc ON u.id=pc.user_id
		 LEFT JOIN pet_state ps ON ps.user_id=u.id
		 WHERE pc.code=$1 AND pc.expires_at > now() AND pc.used=false`, pairCode,
	).Scan(&pairUserID, &pairNickname, &pairYaya, &pairSpecies)
	if err != nil { return nil, fmt.Errorf("配对码无效或已过期。请让你的闺蜜重新生成配对码~") }
	if pairUserID == userID { return nil, fmt.Errorf("不能和自己配对哦 :P") }

	// 检查是否已有配对
	var existing string
	s.pool.QueryRow(ctx, `SELECT id::text FROM soulmate_pairs WHERE (user1_id=$1 OR user2_id=$1) AND status='active'`, userID).Scan(&existing)
	if existing != "" { return nil, fmt.Errorf("你已经有一个配对了。先解除现有配对再和新的闺蜜配对～") }

	// 获取自己的信息
	var myNickname, myYaya, mySpecies string
	s.pool.QueryRow(ctx,
		`SELECT nickname, COALESCE(yaya_nickname,'牙牙'), COALESCE((SELECT species FROM pet_state WHERE user_id=users.id),'云狐')
		 FROM users WHERE id=$1`, userID,
	).Scan(&myNickname, &myYaya, &mySpecies)

	// 创建配对
	pairID := uuid.New().String()

	s.pool.Exec(ctx,
		`INSERT INTO soulmate_pairs (id, user1_id, user2_id, yaya_bond)
		 VALUES ($1,$2,$3,$4)`, pairID, userID, pairUserID, randomBond())
	s.pool.Exec(ctx, `UPDATE pair_codes SET used=true, used_by=$1 WHERE code=$2`, userID, pairCode)

	// 牙牙初次见面 — 自动生成互动
	s.generateFirstMeeting(ctx, pairID, myYaya, pairYaya, speciesEmoji(mySpecies), speciesEmoji(pairSpecies))

	emoji1, emoji2 := speciesEmoji(mySpecies), speciesEmoji(pairSpecies)
	return map[string]interface{}{
		"paired": true, "pair_id": pairID,
		"my_yaya": map[string]string{"name": myYaya, "emoji": emoji1},
		"friend_name": pairNickname, "friend_yaya": map[string]string{"name": pairYaya, "emoji": emoji2},
		"yaya_message": fmt.Sprintf("🎉 %s和%s成为好朋友了！她们正在互相打招呼～", myYaya, pairYaya),
	}, nil
}

func (s *Service) GetMyPair(ctx context.Context, userID string) (*SoulmatePair, error) {
	var p SoulmatePair
	var mySpecies, pairSpecies string

	err := s.pool.QueryRow(ctx,
		`SELECT sp.id::text,
		 COALESCE(u1.yaya_nickname,'牙牙'), COALESCE(ps1.species,'云狐'),
		 u2.nickname, COALESCE(u2.yaya_nickname,'牙牙'), COALESCE(ps2.species,'云狐'),
		 sp.created_at, COALESCE(sp.yaya_bond,'best_friends')
		 FROM soulmate_pairs sp
		 JOIN users u1 ON sp.user1_id=u1.id
		 JOIN users u2 ON sp.user2_id=u2.id
		 LEFT JOIN pet_state ps1 ON ps1.user_id=u1.id
		 LEFT JOIN pet_state ps2 ON ps2.user_id=u2.id
		 WHERE (sp.user1_id=$1 OR sp.user2_id=$1) AND sp.status='active'`, userID,
	).Scan(&p.ID, &p.MyYayaName, &mySpecies, &p.PairName, &p.PairYayaName, &pairSpecies, &p.PairedAt, &p.YayaBond)
	if err != nil { return nil, fmt.Errorf("还没有配对哦～找一个闺蜜一起玩牙牙吧！") }

	p.MyYayaEmoji, p.PairYayaEmoji = speciesEmoji(mySpecies), speciesEmoji(pairSpecies)
	return &p, nil
}

func (s *Service) YayaVisit(ctx context.Context, userID string) (map[string]interface{}, error) {
	pair, err := s.GetMyPair(ctx, userID)
	if err != nil { return nil, err }

	// 随机生成牙牙串门事件
	visitActions := []struct{ action, msg, emoji string }{
		{"gift", fmt.Sprintf("%s给%s送来了一颗星光石 💎", pair.MyYayaEmoji+" "+pair.MyYayaName, pair.PairYayaEmoji+" "+pair.PairYayaName), "🎁"},
		{"play", fmt.Sprintf("%s和%s在浆果森林玩了一下午捉迷藏 🌳", pair.MyYayaEmoji+" "+pair.MyYayaName, pair.PairYayaEmoji+" "+pair.PairYayaName), "🎮"},
		{"chat", fmt.Sprintf("%s趴在%s家门口聊了好久好久...从星星聊到主人 💬", pair.PairYayaEmoji+" "+pair.PairYayaName, pair.MyYayaEmoji+" "+pair.MyYayaName), "💬"},
		{"share", fmt.Sprintf("%s把最喜欢的蜂蜜糖分了一半给%s 🍯", pair.MyYayaEmoji+" "+pair.MyYayaName, pair.PairYayaEmoji+" "+pair.PairYayaName), "🍯"},
	}

	action := visitActions[rand.Intn(len(visitActions))]
	msgID := uuid.New().String()
	s.pool.Exec(ctx,
		`INSERT INTO yaya_interactions (id, pair_id, from_yaya, to_yaya, content, emoji, action_type)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`, msgID, pair.ID, pair.MyYayaName, pair.PairYayaName, action.msg, action.emoji, action.action)

	return map[string]interface{}{"action": action.action, "emoji": action.emoji, "message": action.msg}, nil
}

func (s *Service) GetYayaConversation(ctx context.Context, userID string) ([]YayaMessage, error) {
	pair, err := s.GetMyPair(ctx, userID)
	if err != nil { return nil, err }

	rows, _ := s.pool.Query(ctx,
		`SELECT id::text, from_yaya, to_yaya, emoji, content, created_at::text
		 FROM yaya_interactions WHERE pair_id=$1 ORDER BY created_at DESC LIMIT 30`, pair.ID)
	if rows == nil { return nil, nil }
	defer rows.Close()

	var msgs []YayaMessage
	for rows.Next() { var m YayaMessage; rows.Scan(&m.ID, &m.FromYaya, &m.ToYaya, &m.Emoji, &m.Content, &m.CreatedAt); msgs = append(msgs, m) }
	return msgs, nil
}

func (s *Service) GetMutualGallery(ctx context.Context, userID string) ([]MutualMoment, error) {
	return []MutualMoment{
		{Date: time.Now().Format("2006-01-02"), Type: "first_pair", Title: "牙牙们初次见面", Emoji: "🎉", MyNote: "今天是个特别的日子！"},
	}, nil
}

func (s *Service) Unpair(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE soulmate_pairs SET status='unpaired' WHERE (user1_id=$1 OR user2_id=$1) AND status='active'`, userID)
	return err
}

// ═══════ 生成首次见面互动 ═══════
func (s *Service) generateFirstMeeting(ctx context.Context, pairID, yaya1, yaya2, emoji1, emoji2 string) {
	dialogue := []struct{ from, to, content, emoji string }{
		{fmt.Sprintf("%s%s", emoji1, yaya1), fmt.Sprintf("%s%s", emoji2, yaya2), fmt.Sprintf("你好呀！我叫%s，是%s的灵伴～以后我们就是朋友了！", yaya1, "主人"), "👋"},
		{fmt.Sprintf("%s%s", emoji2, yaya2), fmt.Sprintf("%s%s", emoji1, yaya1), fmt.Sprintf("你好你好～我是%s！我们的主人也是好朋友呢！", yaya2), "🥰"},
		{fmt.Sprintf("%s%s", emoji1, yaya1), fmt.Sprintf("%s%s", emoji2, yaya2), "以后可以常来我家玩！我有很多浆果可以分享 🍓", "🍓"},
		{fmt.Sprintf("%s%s", emoji2, yaya2), fmt.Sprintf("%s%s", emoji1, yaya1), "好呀好呀！我们一起去探险吧！", "🗺️"},
	}

	for _, d := range dialogue {
		s.pool.Exec(ctx,
			`INSERT INTO yaya_interactions (id, pair_id, from_yaya, to_yaya, content, emoji, action_type)
			 VALUES ($1,$2,$3,$4,$5,$6,'first_meet')`, uuid.New().String(), pairID, d.from, d.to, d.content, d.emoji)
	}
}

// ═══════ 辅助 ═══════
func randomBond() string {
	bonds := []string{"best_friends", "sisters", "partners_in_crime", "soul_sisters"}
	return bonds[rand.Intn(len(bonds))]
}

func speciesEmoji(s string) string {
	m := map[string]string{"云狐":"🦊","墨猫":"🐱","芽龙":"🐲","泡兔":"🐰","岩熊":"🐻"}
	if e, ok := m[s]; ok { return e }
	return "🧸"
}
