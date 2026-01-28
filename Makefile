# =============================================================================
# Magicodex Makefile
# =============================================================================
# Simplifies common development and deployment tasks
# Usage: make <target>
# =============================================================================

.PHONY: help dev dev-up dev-down build push deploy logs shell clean test lint

# Default target
help:
	@echo "Magicodex - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev-up      - Start development containers (postgres, redis)"
	@echo "  make dev-down    - Stop development containers"
	@echo "  make dev         - Start backend in dev mode (requires dev-up first)"
	@echo "  make frontend    - Start frontend in dev mode"
	@echo ""
	@echo "Docker Production:"
	@echo "  make build       - Build production Docker images"
	@echo "  make up          - Start production stack"
	@echo "  make down        - Stop production stack"
	@echo "  make logs        - Follow production logs"
	@echo "  make shell       - Shell into backend container"
	@echo ""
	@echo "Database:"
	@echo "  make migrate     - Run Prisma migrations"
	@echo "  make studio      - Open Prisma Studio"
	@echo "  make seed        - Seed database with initial data"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean       - Remove all containers and volumes"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run linters"
	@echo "  make sync        - Trigger Scryfall sync"

# =============================================================================
# Development
# =============================================================================

dev-up:
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Development services started:"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis: localhost:6379"
	@echo "  pgAdmin: localhost:5050"
	@echo "  Redis Commander: localhost:8081"

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev:
	cd backend && npm run dev

frontend:
	cd frontend && npm run dev

# =============================================================================
# Docker Production
# =============================================================================

build:
	docker-compose build --no-cache

up:
	docker-compose up -d
	@echo "Production stack started"
	@docker-compose ps

down:
	docker-compose down

logs:
	docker-compose logs -f backend

logs-all:
	docker-compose logs -f

shell:
	docker-compose exec backend sh

# =============================================================================
# Database
# =============================================================================

migrate:
	cd backend && npx prisma migrate deploy

migrate-dev:
	cd backend && npx prisma migrate dev

studio:
	cd backend && npx prisma studio

generate:
	cd backend && npx prisma generate

# =============================================================================
# Testing & Linting
# =============================================================================

test:
	cd backend && npm test
	cd frontend && npm test

test-backend:
	cd backend && npm test

test-frontend:
	cd frontend && npm test

lint:
	cd backend && npm run lint
	cd frontend && npm run lint

# =============================================================================
# Maintenance
# =============================================================================

clean:
	docker-compose down -v --remove-orphans
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	docker system prune -f

# Install dependencies
install:
	cd backend && npm install
	cd frontend && npm install

# Build frontend for production
build-frontend:
	cd frontend && npm run build
	@echo "Frontend built to frontend/dist"

# Copy frontend build to VPS nginx location
deploy-frontend:
	rsync -avz --delete frontend/dist/ user@vps:/var/www/magicodex/frontend/

# Full deploy (build + sync)
deploy: build-frontend
	@echo "Deploying to production..."
	docker-compose build backend
	docker-compose up -d backend migrations
	@echo "Deployment complete!"

# Trigger Scryfall sync via API
sync:
	@echo "Triggering Scryfall sync..."
	curl -X POST http://localhost:3001/api/admin/sync/trigger \
		-H "Authorization: Bearer $(TOKEN)" \
		-H "Content-Type: application/json" \
		-d '{"type": "full"}'

# Backup database
backup:
	@mkdir -p backups
	docker-compose exec postgres pg_dump -U magicodex magicodex > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup saved to backups/"

# Restore database from backup
restore:
	@echo "Usage: make restore FILE=backups/backup_YYYYMMDD_HHMMSS.sql"
	@test -n "$(FILE)" || (echo "FILE not specified" && exit 1)
	cat $(FILE) | docker-compose exec -T postgres psql -U magicodex magicodex
