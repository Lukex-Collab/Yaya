package nfc

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NTAG215 微信小程序可读写的NFC标签标准
// UID: 7字节唯一标识符，出厂固化
// 容量: 540字节，可存储宠物属性数据

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type NFCBinding struct {
	NfcUID    string `json:"nfc_uid"`
	Species   string `json:"species"`
	PetName   string `json:"pet_name"`
	UserID    string `json:"user_id,omitempty"`
	BoundAt   string `json:"bound_at"`
	IsBound   bool   `json:"is_bound"`
}

type BindResult struct {
	NfcUID    string `json:"nfc_uid"`
	Species   string `json:"species"`
	PetName   string `json:"pet_name"`
	PetEmoji  string `json:"pet_emoji"`
	Message   string `json:"message"`
	IsFirstBind bool `json:"is_first_bind"`
}

func (s *Service) BindNFC(ctx context.Context, userID, nfcUID, species, petName string) (*BindResult, error) {
	if !isValidNTAG215UID(nfcUID) {
		return nil, fmt.Errorf("无效的NFC标签 (需要NTAG215 7字节UID)")
	}
	if !isValidSpecies(species) {
		return nil, fmt.Errorf("不支持的物种: %s (支持: 云狐/墨猫/芽龙/泡兔/岩熊)", species)
	}

	// 检查是否已被绑定
	var existingOwner string
	err := s.pool.QueryRow(ctx,
		`SELECT user_id::text FROM nfc_bindings WHERE nfc_uid=$1 AND status='active'`, nfcUID,
	).Scan(&existingOwner)
	isFirstBind := err != nil
	if !isFirstBind && existingOwner != userID {
		return nil, fmt.Errorf("这个玩具已经属于别人了 :( 每个玩具的世界里只能有一个主人")
	}

	// 写入绑定
	s.pool.Exec(ctx,
		`INSERT INTO nfc_bindings (nfc_uid, user_id, species, name, status)
		 VALUES ($1,$2,$3,$4,'active') ON CONFLICT (nfc_uid) DO UPDATE SET user_id=$2, species=$3, name=$4, status='active', bound_at=now()`,
		nfcUID, userID, species, petName)

	emoji := speciesEmoji(species)
	return &BindResult{
		NfcUID: nfcUID, Species: species, PetName: petName,
		PetEmoji: emoji, IsFirstBind: isFirstBind,
		Message: fmt.Sprintf("🎉 绑定成功！你的%s %s已激活。NFC标签唯一，全世界只有你拥有这只%s。", emoji, petName, species),
	}, nil
}

func (s *Service) GetMyNFCInfo(ctx context.Context, userID string) (*NFCBinding, error) {
	var b NFCBinding
	var boundAt time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT nfc_uid, species, COALESCE(name,''), bound_at FROM nfc_bindings WHERE user_id=$1 AND status='active'`, userID,
	).Scan(&b.NfcUID, &b.Species, &b.PetName, &boundAt)
	if err != nil { return nil, fmt.Errorf("还没有绑定NFC玩具哦～") }
	b.BoundAt = boundAt.Format(time.RFC3339)
	b.IsBound = true
	return &b, nil
}

func (s *Service) UnbindNFC(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE nfc_bindings SET status='unbound' WHERE user_id=$1 AND status='active'`, userID)
	return err
}

func (s *Service) VerifyNFC(ctx context.Context, nfcUID string) (*NFCBinding, error) {
	var b NFCBinding
	var boundAt time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT n.nfc_uid, n.species, COALESCE(n.name,''), u.nickname, n.bound_at
		 FROM nfc_bindings n LEFT JOIN users u ON n.user_id=u.id
		 WHERE n.nfc_uid=$1 AND n.status='active'`, nfcUID,
	).Scan(&b.NfcUID, &b.Species, &b.PetName, &b.UserID, &boundAt)
	if err != nil {
		return &NFCBinding{NfcUID: nfcUID, IsBound: false}, nil
	}
	b.BoundAt = boundAt.Format(time.RFC3339)
	b.IsBound = true
	return &b, nil
}

// ═══════════ 辅助 ═══════════

func isValidNTAG215UID(uid string) bool {
	return len(uid) == 14 && isHexString(uid)
}

func isHexString(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) { return false }
	}
	return true
}

func isValidSpecies(s string) bool {
	switch s {
	case "云狐", "墨猫", "芽龙", "泡兔", "岩熊":
		return true
	}
	return false
}

func speciesEmoji(s string) string {
	m := map[string]string{"云狐":"🦊","墨猫":"🐱","芽龙":"🐲","泡兔":"🐰","岩熊":"🐻"}
	return m[s]
}
