-- =============================================================================
-- Magicodex - PostgreSQL Initialization Script
-- =============================================================================
-- This script runs on first database creation
-- =============================================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS unaccent;     -- Remove accents for search
CREATE EXTENSION IF NOT EXISTS btree_gin;    -- GIN indexes for arrays

-- Set default timezone
SET timezone = 'UTC';

-- Performance tuning for the session
-- These are overridden by postgresql.conf in production
SET work_mem = '64MB';
SET maintenance_work_mem = '128MB';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE magicodex TO magicodex;
