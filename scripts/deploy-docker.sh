#!/bin/bash
# =============================================================================
# Magicodex Deployment Script
# =============================================================================
# Usage: ./scripts/deploy-docker.sh [command]
# Commands: build, deploy, rollback, status, logs
# =============================================================================

set -e

# Configuration
APP_NAME="magicodex"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"  # Optional: your.registry.com
IMAGE_TAG="${IMAGE_TAG:-latest}"
BACKUP_DIR="./backups"
MAX_BACKUPS=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Functions
# =============================================================================

check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        log_error ".env file not found. Copy docker/.env.example to .env and configure it."
        exit 1
    fi
    
    log_info "Requirements OK"
}

backup_database() {
    log_info "Backing up database..."
    
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
    
    docker-compose exec -T postgres pg_dump -U magicodex magicodex > "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        gzip "$BACKUP_FILE"
        log_info "Backup saved: ${BACKUP_FILE}.gz"
        
        # Clean old backups
        ls -t ${BACKUP_DIR}/backup_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm
    else
        log_error "Backup failed!"
        exit 1
    fi
}

build_images() {
    log_info "Building Docker images..."
    
    # Build backend
    docker build -f docker/Dockerfile.backend -t ${APP_NAME}-backend:${IMAGE_TAG} .
    
    # Build frontend (optional, if you want to containerize it)
    # docker build -f docker/Dockerfile.frontend -t ${APP_NAME}-frontend:${IMAGE_TAG} .
    
    log_info "Images built successfully"
    
    # Push to registry if configured
    if [ -n "$DOCKER_REGISTRY" ]; then
        log_info "Pushing to registry..."
        docker tag ${APP_NAME}-backend:${IMAGE_TAG} ${DOCKER_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}
        docker push ${DOCKER_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}
    fi
}

build_frontend() {
    log_info "Building frontend..."
    
    cd frontend
    npm ci
    npm run build
    cd ..
    
    log_info "Frontend built to frontend/dist"
}

deploy() {
    log_info "Deploying ${APP_NAME}..."
    
    # Backup before deploy
    if docker-compose ps postgres | grep -q "Up"; then
        backup_database
    fi
    
    # Pull latest images (if using registry)
    if [ -n "$DOCKER_REGISTRY" ]; then
        docker-compose pull
    fi
    
    # Run migrations
    log_info "Running database migrations..."
    docker-compose run --rm migrations
    
    # Deploy with zero-downtime
    log_info "Starting services..."
    docker-compose up -d --remove-orphans
    
    # Wait for health check
    log_info "Waiting for services to be healthy..."
    sleep 5
    
    # Check health
    if curl -sf http://localhost:3001/health > /dev/null; then
        log_info "✅ Deployment successful!"
        docker-compose ps
    else
        log_error "❌ Health check failed!"
        log_warn "Rolling back..."
        rollback
        exit 1
    fi
}

rollback() {
    log_info "Rolling back to previous version..."
    
    # Get the latest backup
    LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/backup_*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        log_warn "No backup found to restore"
    else
        log_info "Restoring from: $LATEST_BACKUP"
        gunzip -c "$LATEST_BACKUP" | docker-compose exec -T postgres psql -U magicodex magicodex
    fi
    
    # Restart with previous image
    docker-compose down
    docker-compose up -d
    
    log_info "Rollback complete"
}

show_status() {
    log_info "Service Status:"
    docker-compose ps
    
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        ${APP_NAME}-backend ${APP_NAME}-db ${APP_NAME}-redis 2>/dev/null || true
    
    echo ""
    log_info "Health Check:"
    curl -s http://localhost:3001/health | jq . 2>/dev/null || echo "Backend not responding"
}

show_logs() {
    SERVICE="${1:-backend}"
    docker-compose logs -f "$SERVICE"
}

# =============================================================================
# Main
# =============================================================================

check_requirements

case "${1:-deploy}" in
    build)
        build_images
        ;;
    build-frontend)
        build_frontend
        ;;
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    backup)
        backup_database
        ;;
    *)
        echo "Usage: $0 {build|build-frontend|deploy|rollback|status|logs|backup}"
        exit 1
        ;;
esac
