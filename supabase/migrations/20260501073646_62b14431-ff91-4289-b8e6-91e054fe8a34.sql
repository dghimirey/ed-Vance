-- Calendar events table
CREATE TYPE public.calendar_event_type AS ENUM ('holiday', 'exam', 'meeting', 'event', 'notice');

CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type public.calendar_event_type NOT NULL DEFAULT 'event',
  event_date DATE NOT NULL,
  bs_year INTEGER,
  bs_month INTEGER,
  bs_day INTEGER,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_bs ON public.calendar_events(bs_year, bs_month);
CREATE INDEX idx_calendar_events_class ON public.calendar_events(class_id, section_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admins manage calendar_events"
ON public.calendar_events FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated can view (school-wide events + scoped events; client filters per-role)
CREATE POLICY "Authenticated view calendar_events"
ON public.calendar_events FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();