-- ============================================
-- Quick SQL Script: Add outline_sections column
-- ============================================
-- Run this in Supabase SQL Editor to add the new column
-- ============================================

-- Add the outline_sections JSONB column
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS outline_sections JSONB;

-- Add comment for documentation
COMMENT ON COLUMN articles.outline_sections IS 
'Structured outline data as JSONB array. Structure: [{"id": "uuid", "level": "H1|H2|H3", "title": "string", "description": "string", "wordCountEstimate": number}]';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'articles' AND column_name = 'outline_sections';




