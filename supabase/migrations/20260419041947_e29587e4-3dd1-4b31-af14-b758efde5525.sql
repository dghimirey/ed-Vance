
-- 1. Create student_parents join table
CREATE TABLE public.student_parents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL,
  relation TEXT NOT NULL DEFAULT 'guardian',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, parent_id)
);

CREATE INDEX idx_student_parents_student ON public.student_parents(student_id);
CREATE INDEX idx_student_parents_parent ON public.student_parents(parent_id);

ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

-- 2. RLS for student_parents
CREATE POLICY "Admins manage student_parents"
  ON public.student_parents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parents view own links"
  ON public.student_parents FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Teachers view links for assigned students"
  ON public.student_parents FOR SELECT
  USING (
    has_role(auth.uid(), 'teacher'::app_role) AND EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.teacher_assignments ta
        ON ta.class_id = s.class_id AND ta.section_id = s.section_id
      WHERE s.id = student_parents.student_id
        AND ta.teacher_id = auth.uid()
    )
  );

-- 3. Backfill from legacy students.parent_id
INSERT INTO public.student_parents (student_id, parent_id, relation)
SELECT id, parent_id, 'guardian'
FROM public.students
WHERE parent_id IS NOT NULL
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 4. Update parent SELECT policies on related tables to honor many-to-many
DROP POLICY IF EXISTS "Parents can view own children" ON public.students;
CREATE POLICY "Parents can view own children"
  ON public.students FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND (
      parent_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.student_parents sp
        WHERE sp.student_id = students.id AND sp.parent_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Parents can view children attendance" ON public.attendance;
CREATE POLICY "Parents can view children attendance"
  ON public.attendance FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = attendance.student_id
        AND (
          s.parent_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            WHERE sp.student_id = s.id AND sp.parent_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Parents can view children marks" ON public.marks;
CREATE POLICY "Parents can view children marks"
  ON public.marks FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = marks.student_id
        AND (
          s.parent_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            WHERE sp.student_id = s.id AND sp.parent_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Parents can view children assignments" ON public.assignments;
CREATE POLICY "Parents can view children assignments"
  ON public.assignments FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assignments.student_id
        AND (
          s.parent_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            WHERE sp.student_id = s.id AND sp.parent_id = auth.uid()
          )
        )
    )
  );

-- 5. Enable realtime
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.teacher_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.student_parents REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_assignments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_parents;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
