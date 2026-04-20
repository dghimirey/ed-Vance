
-- Helper: is the given user a parent of the given student?
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id
      AND (s.parent_id = _user_id
           OR EXISTS (SELECT 1 FROM public.student_parents sp
                      WHERE sp.student_id = _student_id AND sp.parent_id = _user_id))
  )
$$;

-- Helper: is the given user a teacher assigned to the student's class+section?
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.teacher_assignments ta
      ON ta.class_id = s.class_id AND ta.section_id = s.section_id
    WHERE s.id = _student_id AND ta.teacher_id = _user_id
  )
$$;

-- ============ STUDENTS ============
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Parents can view own children" ON public.students;
DROP POLICY IF EXISTS "Teachers can view assigned students" ON public.students;

CREATE POLICY "Admins can manage students"
ON public.students FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parents can view own children"
ON public.students FOR SELECT
USING (
  public.has_role(auth.uid(), 'parent'::app_role)
  AND (
    parent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = students.id AND sp.parent_id = auth.uid()
    )
  )
);

CREATE POLICY "Teachers can view assigned students"
ON public.students FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
      AND ta.class_id = students.class_id
      AND ta.section_id = students.section_id
  )
);

-- ============ STUDENT_PARENTS ============
DROP POLICY IF EXISTS "Admins manage student_parents" ON public.student_parents;
DROP POLICY IF EXISTS "Parents view own links" ON public.student_parents;
DROP POLICY IF EXISTS "Teachers view links for assigned students" ON public.student_parents;

CREATE POLICY "Admins manage student_parents"
ON public.student_parents FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parents view own links"
ON public.student_parents FOR SELECT
USING (parent_id = auth.uid());

-- Use security-definer helper to avoid recursion through students policies
CREATE POLICY "Teachers view links for assigned students"
ON public.student_parents FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
);

-- ============ MARKS / ATTENDANCE / ASSIGNMENTS — also referenced students ============
-- These already work but rewrite to use helpers for consistency and to avoid future recursion.

DROP POLICY IF EXISTS "Parents can view children marks" ON public.marks;
CREATE POLICY "Parents can view children marks"
ON public.marks FOR SELECT
USING (
  public.has_role(auth.uid(), 'parent'::app_role)
  AND public.is_parent_of_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Teachers can manage assigned marks" ON public.marks;
CREATE POLICY "Teachers can manage assigned marks"
ON public.marks FOR ALL
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Parents can view children attendance" ON public.attendance;
CREATE POLICY "Parents can view children attendance"
ON public.attendance FOR SELECT
USING (
  public.has_role(auth.uid(), 'parent'::app_role)
  AND public.is_parent_of_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Teachers can manage assigned attendance" ON public.attendance;
CREATE POLICY "Teachers can manage assigned attendance"
ON public.attendance FOR ALL
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Parents can view children assignments" ON public.assignments;
CREATE POLICY "Parents can view children assignments"
ON public.assignments FOR SELECT
USING (
  public.has_role(auth.uid(), 'parent'::app_role)
  AND public.is_parent_of_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Teachers can manage assigned assignments" ON public.assignments;
CREATE POLICY "Teachers can manage assigned assignments"
ON public.assignments FOR ALL
USING (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::app_role)
  AND public.is_teacher_of_student(auth.uid(), student_id)
);
