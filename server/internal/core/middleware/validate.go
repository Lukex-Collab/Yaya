package middleware

import (
	"bytes"
	"io"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/lingpal/platform/internal/core/response"
)

// MaxBodySize 请求体最大 1MB
const MaxBodySize = 1 << 20

// ValidateBody 请求体大小和 UTF-8 校验
func ValidateBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body == nil {
			c.Next()
			return
		}

		// 限制读取大小
		limitedReader := io.LimitReader(c.Request.Body, MaxBodySize+1)
		body, err := io.ReadAll(limitedReader)
		if err != nil {
			response.BadRequest(c, "无法读取请求体")
			c.Abort()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		// 大小检查
		if len(body) > MaxBodySize {
			response.BadRequest(c, "请求体过大，最大1MB")
			c.Abort()
			return
		}

		// UTF-8 校验
		if !utf8.Valid(body) {
			response.BadRequest(c, "请求包含无效字符")
			c.Abort()
			return
		}

		c.Next()
	}
}

// ContentType 强制 JSON
func RequireJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		ct := c.GetHeader("Content-Type")
		if ct != "" && ct != "application/json" && ct != "application/json; charset=utf-8" {
			response.BadRequest(c, "仅支持 application/json")
			c.Abort()
			return
		}
		c.Next()
	}
}
