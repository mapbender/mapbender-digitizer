-- Migration: Create user_styles table for Digitizer user style management
-- Run this SQL on the same database connection the Digitizer uses for its feature types
-- (e.g. the geodata / digitizer database, NOT the Mapbender application database).
--
-- The default schema.table name is "public.user_styles".
-- Adjust the schema and table name if your Digitizer element uses a different configuration.


-- Create the user_styles table
CREATE TABLE IF NOT EXISTS public.user_styles (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    style_config TEXT        NOT NULL,
    created_at  TIMESTAMP    DEFAULT NULL,
    updated_at  TIMESTAMP    DEFAULT NULL
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_styles_user_id ON public.user_styles (user_id);
