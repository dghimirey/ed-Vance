ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.marks REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marks;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;