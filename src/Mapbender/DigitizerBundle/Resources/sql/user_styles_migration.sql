-- Migration: Add user_styles table for storing user-specific digitizer styles
-- Run this on the digitizer database
-- NOTE: The table name must match the configured 'mb.digitizer.user_styles_table' parameter (default: digi.user_styles)

CREATE TABLE IF NOT EXISTS digi.user_styles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    style_config JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_styles_user_id ON digi.user_styles(user_id);

-- Trigger to auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_user_styles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_styles_updated_at ON digi.user_styles;
CREATE TRIGGER trigger_user_styles_updated_at
    BEFORE UPDATE ON digi.user_styles
    FOR EACH ROW
EXECUTE FUNCTION update_user_styles_updated_at();
