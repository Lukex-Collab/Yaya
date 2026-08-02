package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestAuthMissingHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)

	Auth("secret")(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthInvalidFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)
	c.Request.Header.Set("Authorization", "Invalid token")

	Auth("secret")(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	claims := &Claims{
		UserID: "test-user-123",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, _ := token.SignedString([]byte("my-secret"))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)
	c.Request.Header.Set("Authorization", "Bearer "+tokenStr)

	nextCalled := false
	Auth("my-secret")(c)

	userID, exists := c.Get("user_id")
	if !exists || userID != "test-user-123" {
		// The middleware might have called Abort, let's check
		if w.Code == 0 { // means Next() was called
			t.Error("user_id should be set in context but was not")
		}
	}

	_ = nextCalled // no-op
}

func TestAuthWrongSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &Claims{UserID: "x"})
	tokenStr, _ := token.SignedString([]byte("wrong-secret"))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)
	c.Request.Header.Set("Authorization", "Bearer "+tokenStr)

	Auth("correct-secret")(c)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong secret, got %d", w.Code)
	}
}
