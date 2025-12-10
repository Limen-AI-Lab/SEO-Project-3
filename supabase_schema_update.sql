-- ============================================
-- Supabase Schema Update for Two-Portal Integration
-- ============================================
-- This file contains updates to the existing schema to support
-- the interaction between Agency Portal and Client Portal
-- ============================================

-- 1. Add missing fields to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS selected_title TEXT;

-- 2. Create status enum type (PostgreSQL native enum)
-- Note: If enum already exists, this will fail gracefully
DO $$ BEGIN
    CREATE TYPE article_status_enum AS ENUM (
        'NEEDS_TITLES',
        'AWAITING_REVIEW_TITLES',
        'TITLES_APPROVED',
        'AWAITING_REVIEW_OUTLINE',
        'OUTLINE_APPROVED',
        'AWAITING_REVIEW_DRAFT',
        'DRAFT_APPROVED',
        'NEEDS_REVISION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Add CHECK constraint for status field (if not using enum)
-- Alternative approach: Use CHECK constraint instead of enum
-- This allows more flexibility and doesn't require dropping/recreating the column
ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE articles 
ADD CONSTRAINT articles_status_check 
CHECK (status IN (
    'NEEDS_TITLES',
    'AWAITING_REVIEW_TITLES',
    'TITLES_APPROVED',
    'AWAITING_REVIEW_OUTLINE',
    'OUTLINE_APPROVED',
    'AWAITING_REVIEW_DRAFT',
    'DRAFT_APPROVED',
    'NEEDS_REVISION'
));

-- 4. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_campaign_id ON articles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_articles_last_updated ON articles(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);

-- 5. Create function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_articles_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to auto-update last_updated
DROP TRIGGER IF EXISTS trigger_update_articles_last_updated ON articles;

CREATE TRIGGER trigger_update_articles_last_updated
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_articles_last_updated();

-- 7. Add comment to status column for documentation
COMMENT ON COLUMN articles.status IS 'Article workflow status. Valid values: NEEDS_TITLES, AWAITING_REVIEW_TITLES, TITLES_APPROVED, AWAITING_REVIEW_OUTLINE, OUTLINE_APPROVED, AWAITING_REVIEW_DRAFT, DRAFT_APPROVED, NEEDS_REVISION';

COMMENT ON COLUMN articles.client_comments IS 'JSONB array of client feedback comments. Structure: [{"id": "uuid", "author": "Client", "text": "comment text", "timestamp": "ISO date string"}]';

COMMENT ON COLUMN articles.selected_title IS 'The title selected by the client from proposed_titles array';

COMMENT ON COLUMN articles.last_updated IS 'Timestamp of last update to the article. Auto-updated by trigger.';

-- 8. Update existing NULL statuses to default value
UPDATE articles 
SET status = 'NEEDS_TITLES' 
WHERE status IS NULL;

-- 9. Set NOT NULL constraint on status (after updating NULLs)
ALTER TABLE articles 
ALTER COLUMN status SET NOT NULL;

-- 10. Create view for articles awaiting client review (optional, for easier querying)
CREATE OR REPLACE VIEW articles_awaiting_review AS
SELECT 
    a.id,
    a.title,
    a.status,
    a.campaign_id,
    c.name as campaign_name,
    cl.name as client_name,
    a.created_at,
    a.last_updated
FROM articles a
JOIN campaigns c ON a.campaign_id = c.id
JOIN clients cl ON c.client_id = cl.id
WHERE a.status IN (
    'AWAITING_REVIEW_TITLES',
    'AWAITING_REVIEW_OUTLINE',
    'AWAITING_REVIEW_DRAFT'
)
ORDER BY a.last_updated DESC;

-- 11. Grant permissions on view
GRANT SELECT ON articles_awaiting_review TO public;

