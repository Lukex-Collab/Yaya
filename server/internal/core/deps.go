package core

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openai/openai-go"
	"github.com/redis/go-redis/v9"
)

type Dependencies struct {
	Pool     *pgxpool.Pool
	Redis    *redis.Client
	Config   *Config
	DeepSeek *openai.Client
}
