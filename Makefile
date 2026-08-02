.PHONY: dev-up dev-down migrate seed test test-integration lint fmt run run-server

# 基础设施
dev-up:
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 3
	@docker compose ps

dev-down:
	docker compose down

# 数据库迁移
migrate:
	cd server && GOPROXY=https://goproxy.cn,direct go run cmd/migrate/main.go up

migrate-down:
	cd server && go run cmd/migrate/main.go down

migrate-new:
	cd server && goose -dir migrations create $(NAME) sql

# 种子数据
seed:
	cd server && go run cmd/migrate/main.go seed

# 运行
run:
	cd server && GOPROXY=https://goproxy.cn,direct go run cmd/server/main.go

# 测试
test:
	cd server && go test ./internal/... -v -cover

test-integration:
	cd server && go test ./internal/... -v -cover -tags=integration

test-ci:
	cd server && go test ./internal/... -v -cover -count=1 -short

# 代码质量
lint:
	cd server && golangci-lint run ./...

fmt:
	cd server && gofmt -w .

tidy:
	cd server && go mod tidy

# 构建
build:
	cd server && GOPROXY=https://goproxy.cn,direct go build -o server.exe ./cmd/server

# 安装依赖
deps:
	cd server && GOPROXY=https://goproxy.cn,direct go mod download
