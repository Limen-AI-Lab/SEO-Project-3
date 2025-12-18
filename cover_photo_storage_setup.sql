-- Cover Photo Storage Setup
-- Run this SQL in Supabase SQL Editor if you encounter permission issues with the cover_photo bucket

-- 1. Create the bucket if it doesn't exist (you may have already created it via UI)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('cover_photo', 'cover_photo', true)
-- ON CONFLICT (id) DO NOTHING;

-- 2. Set up security policies for the 'cover_photo' bucket

-- Allow public read access to all files in the bucket
CREATE POLICY "Allow public read access to cover_photo"
ON storage.objects FOR SELECT
USING ( bucket_id = 'cover_photo' );

-- Allow authenticated/anonymous users to upload files
CREATE POLICY "Allow public upload to cover_photo"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'cover_photo' );

-- Allow users to update their own files
CREATE POLICY "Allow public update to cover_photo"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'cover_photo' );

-- Allow users to delete files
CREATE POLICY "Allow public delete from cover_photo"
ON storage.objects FOR DELETE
USING ( bucket_id = 'cover_photo' );

