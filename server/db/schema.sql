CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS townships (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  primary_source TEXT NOT NULL,
  name TEXT NOT NULL,
  township_id BIGINT REFERENCES townships(id),
  address TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  opening_hours TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  price_range TEXT CHECK (price_range IN ('$', '$$', '$$$') OR price_range IS NULL),
  rating NUMERIC(2, 1),
  review_count INTEGER,
  review_summary TEXT NOT NULL DEFAULT '',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (primary_source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurants_township_id ON restaurants(township_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);

CREATE TABLE IF NOT EXISTS restaurant_sources (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_ref TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (restaurant_id, source_name, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_sources_restaurant_id
  ON restaurant_sources(restaurant_id);

CREATE TABLE IF NOT EXISTS restaurant_menus (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'dish',
  price_amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'MMK',
  description TEXT NOT NULL DEFAULT '',
  is_signature BOOLEAN NOT NULL DEFAULT FALSE,
  source_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, item_name, category, source_name)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menus_restaurant_id
  ON restaurant_menus(restaurant_id);

CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  review_fingerprint TEXT NOT NULL,
  author_name TEXT,
  rating NUMERIC(2, 1),
  review_text TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, source_name, review_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_id
  ON restaurant_reviews(restaurant_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  requested_sources TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  township_count INTEGER NOT NULL DEFAULT 0,
  restaurant_upserts INTEGER NOT NULL DEFAULT 0,
  menu_upserts INTEGER NOT NULL DEFAULT 0,
  review_upserts INTEGER NOT NULL DEFAULT 0,
  source_upserts INTEGER NOT NULL DEFAULT 0,
  error_payload JSONB
);
