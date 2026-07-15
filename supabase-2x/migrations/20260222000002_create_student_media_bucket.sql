-- Create storage bucket for student media uploads (images, audio recordings).
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-media', 'student-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Students can upload their own media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all student media
CREATE POLICY "Public read access for student media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'student-media');

-- Allow students to delete their own media
CREATE POLICY "Students can delete their own media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
