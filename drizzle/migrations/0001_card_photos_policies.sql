CREATE POLICY "card photos readable" ON storage.objects FOR SELECT
  USING (bucket_id = 'card-photos');
CREATE POLICY "card photos own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "card photos own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'card-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "card photos own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'card-photos' AND (storage.foldername(name))[1] = auth.uid()::text);