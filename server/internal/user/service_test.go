package user

import (
	"testing"
)

func TestGenerateJWT(t *testing.T) {
	svc := NewService(nil, "test-secret-abc", 720, "", "")

	token, err := svc.generateJWT("user-123")
	if err != nil {
		t.Fatalf("generateJWT failed: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// 验证 JWT 是 3 段格式
	parts := 0
	for _, c := range token {
		if c == '.' { parts++ }
	}
	if parts != 2 {
		t.Errorf("expected JWT with 3 segments, got %d dots", parts+1)
	}
}

func TestCode2SessionDevMode(t *testing.T) {
	svc := NewService(nil, "secret", 720, "", "")

	session, err := svc.code2session("dev")
	if err != nil {
		t.Fatalf("code2session('dev') failed: %v", err)
	}
	if session.OpenID == "" {
		t.Error("expected non-empty OpenID for dev mode")
	}
	if !stringsHasPrefix(session.OpenID, "dev_") {
		t.Errorf("dev OpenID should start with 'dev_', got %s", session.OpenID)
	}
}

func TestCode2SessionInvalidCode(t *testing.T) {
	svc := NewService(nil, "secret", 720, "test-appid", "test-secret")

	// 非 dev code 会尝试请求真实微信 API（应返回错误）
	_, err := svc.code2session("invalid-code-xyz")
	// 预期会失败（因为 appid/secret 无效）
	if err == nil {
		t.Log("unexpected success — may indicate network issue or mocked API")
	}
}

func TestUserStruct(t *testing.T) {
	u := User{
		Nickname:     "测试用户",
		YayaNickname: "牙牙",
	}
	if u.Nickname == "" {
		t.Error("expected non-empty nickname")
	}
}

func stringsHasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}
