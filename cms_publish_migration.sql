-- CMS Articles Table Migration
-- Run this SQL in your Supabase SQL Editor to create the cms_articles table

-- 1. Create the cms_articles table
CREATE TABLE IF NOT EXISTS cms_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  create_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content TEXT NOT NULL,
  short_text TEXT,
  cover_image TEXT,
  cms_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create an index on article_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_cms_articles_article_id ON cms_articles(article_id);

-- 3. Create an index on create_date for sorting
CREATE INDEX IF NOT EXISTS idx_cms_articles_create_date ON cms_articles(create_date DESC);

-- 4. Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_cms_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_cms_articles_updated_at ON cms_articles;
CREATE TRIGGER set_cms_articles_updated_at
  BEFORE UPDATE ON cms_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_cms_articles_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE cms_articles ENABLE ROW LEVEL SECURITY;

-- 6. Create policy to allow authenticated users to view all cms_articles
CREATE POLICY "Allow public read access to cms_articles"
  ON cms_articles
  FOR SELECT
  USING (true);

-- 7. Create policy to allow authenticated users to insert cms_articles
CREATE POLICY "Allow authenticated insert to cms_articles"
  ON cms_articles
  FOR INSERT
  WITH CHECK (true);

-- 8. Create policy to allow authenticated users to update cms_articles
CREATE POLICY "Allow authenticated update to cms_articles"
  ON cms_articles
  FOR UPDATE
  USING (true);

-- 9. Add a comment to the table for documentation
COMMENT ON TABLE cms_articles IS 'Published articles for CMS consumption. Contains title, content (markdown), short_text, and metadata.';

-- 10. Grant necessary permissions (for anon key access)
GRANT SELECT, INSERT, UPDATE ON cms_articles TO anon;
GRANT SELECT, INSERT, UPDATE ON cms_articles TO authenticated;

