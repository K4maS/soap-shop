-- =============================================================
-- PostgreSQL extensions required by Mylo Master
-- This script runs once during database initialization.
-- =============================================================

-- uuid-ossp: provides uuid_generate_v4() for default PK values
-- Used as a fallback if Prisma doesn't generate UUIDs in the DB layer.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto: provides gen_random_uuid(), crypt(), digest(), etc.
-- Required for server-side password hashing (if ever needed outside Prisma)
-- and for cryptographic operations in stored procedures.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_trgm: trigram similarity for fast full-text ILIKE searches
-- Enables GIN index on product name/description for efficient search.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Performance indexes for audit_logs ────────────────────────
-- These are created here (rather than in migrations) because they are
-- operational / monitoring indexes, not schema-correctness indexes.

-- Allow fast lookup by actor (who performed the action)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
    ON audit_logs (actor_id)
    WHERE actor_id IS NOT NULL;

-- Allow fast filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action);

-- Allow fast time-range queries (most common for compliance reporting)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);

-- Composite index: actor + time range (most frequent admin query)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
    ON audit_logs (actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;

-- ─── Performance indexes for products ──────────────────────────

-- GIN index on product name for fast trigram search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON products USING GIN (name gin_trgm_ops);

-- GIN index on product description for full-text search
CREATE INDEX IF NOT EXISTS idx_products_description_trgm
    ON products USING GIN (description gin_trgm_ops)
    WHERE description IS NOT NULL;

-- Partial index: only active, non-deleted products
CREATE INDEX IF NOT EXISTS idx_products_active
    ON products (category_id, created_at DESC)
    WHERE is_active = true AND deleted_at IS NULL;

-- ─── Performance indexes for orders ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_user_id
    ON orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_ip_address
    ON orders (ip_address, created_at DESC)
    WHERE ip_address IS NOT NULL;
