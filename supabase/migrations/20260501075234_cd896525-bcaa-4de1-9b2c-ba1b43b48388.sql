-- Exam access control: one row per term controlling teacher edit access
CREATE TABLE public.exam_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  is_open boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.exam_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exam_access"
  ON public.exam_access FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage exam_access"
  ON public.exam_access FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.exam_access (term, is_open) VALUES
  ('First Term', false),
  ('Second Term', false),
  ('Third Term', false);

-- Helper: is exam open for a term
CREATE OR REPLACE FUNCTION public.is_exam_open(_term text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_open FROM public.exam_access WHERE term = _term), false)
$$;

-- Lock teachers from writing marks when their term is closed
DROP POLICY IF EXISTS "Teachers can manage assigned marks" ON public.marks;

CREATE POLICY "Teachers view assigned marks"
  ON public.marks FOR SELECT
  USING (has_role(auth.uid(), 'teacher'::app_role) AND is_teacher_of_student(auth.uid(), student_id));

CREATE POLICY "Teachers insert marks when term open"
  ON public.marks FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'teacher'::app_role)
    AND is_teacher_of_student(auth.uid(), student_id)
    AND is_exam_open(term)
  );

CREATE POLICY "Teachers update marks when term open"
  ON public.marks FOR UPDATE
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND is_teacher_of_student(auth.uid(), student_id)
    AND is_exam_open(term)
  )
  WITH CHECK (
    has_role(auth.uid(), 'teacher'::app_role)
    AND is_teacher_of_student(auth.uid(), student_id)
    AND is_exam_open(term)
  );

CREATE POLICY "Teachers delete marks when term open"
  ON public.marks FOR DELETE
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND is_teacher_of_student(auth.uid(), student_id)
    AND is_exam_open(term)
  );

-- Trigger to enforce only-one-open-term invariant
CREATE OR REPLACE FUNCTION public.enforce_single_open_term()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_open = true THEN
    UPDATE public.exam_access
      SET is_open = false, updated_at = now()
      WHERE term <> NEW.term AND is_open = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_open_term
  BEFORE INSERT OR UPDATE ON public.exam_access
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_open_term();

-- Add unique constraint on marks (student, subject, term) to support upsert
DO $$ BEGIN
  ALTER TABLE public.marks ADD CONSTRAINT marks_student_subject_term_unique UNIQUE (student_id, subject_id, term);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;