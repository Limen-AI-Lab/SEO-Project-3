-- Create a new public storage bucket for article covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-covers', 'article-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the 'article-covers' bucket

-- 1. Allow public access to view images (SELECT)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'article-covers' );

-- 2. Allow uploading images (INSERT) - Adjust based on your auth needs
-- For now, allowing anyone to upload for simplicity in this demo environment
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'article-covers' );

-- 3. Allow updating/deleting own images (optional, skipped for now)

-- Add cover_image column to articles table if it doesn't exist
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS cover_image text;

