package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func setup() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c, w
}

func TestOK(t *testing.T) {
	c, w := setup()
	OK(c, map[string]string{"name": "yaya"})
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 0 || resp.Msg != "ok" {
		t.Errorf("unexpected body: %+v", resp)
	}
}

func TestBadRequest(t *testing.T) {
	c, w := setup()
	BadRequest(c, "missing field")
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 40000 || resp.Msg != "missing field" {
		t.Errorf("unexpected body: %+v", resp)
	}
}

func TestUnauthorized(t *testing.T) {
	c, w := setup()
	Unauthorized(c, "token expired")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestNotFound(t *testing.T) {
	c, w := setup()
	NotFound(c, "user not found")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestInternalError(t *testing.T) {
	c, w := setup()
	InternalError(c, "db error")
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestCreated(t *testing.T) {
	c, w := setup()
	Created(c, map[string]int{"id": 1})
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Msg != "created" {
		t.Errorf("unexpected msg: %s", resp.Msg)
	}
}
