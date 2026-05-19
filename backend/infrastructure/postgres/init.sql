-- =============================================================================
-- 360CRD - PostgreSQL Initialization Script
-- Runs once on first container start
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create additional indexes for performance after Prisma migration
-- (Prisma handles table creation via migrations)

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE crd360_db TO crd360_user;
