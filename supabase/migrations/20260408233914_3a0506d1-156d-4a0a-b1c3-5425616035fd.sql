
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent');

-- Create attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'leave');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  numeric_level INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Sections table
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  dob DATE,
  father_name TEXT,
  mother_name TEXT,
  symbol_number TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE RESTRICT NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE RESTRICT NOT NULL,
  parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, symbol_number)
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  credit_hours NUMERIC(4,2) NOT NULL DEFAULT 4,
  th_full_marks INT NOT NULL DEFAULT 75,
  in_full_marks INT NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Class-subject mapping
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

-- Teacher assignments
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, class_id, section_id)
);
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Marks table
CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  term TEXT NOT NULL DEFAULT 'First Term',
  theory_marks NUMERIC(5,2),
  internal_marks NUMERIC(5,2),
  is_ng BOOLEAN DEFAULT false,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, term)
);
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- School settings (single-row config)
CREATE TABLE public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL DEFAULT 'Digital School',
  address TEXT,
  pass_percentage NUMERIC(5,2) NOT NULL DEFAULT 35,
  academic_year TEXT NOT NULL DEFAULT '2081/2082',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marks_updated_at BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_school_settings_updated_at BEFORE UPDATE ON public.school_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS POLICIES ============

-- user_roles: admins see all, users see own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- profiles: everyone can read, users update own, admins manage all
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- classes: everyone can read, admins manage
CREATE POLICY "Authenticated users can view classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- sections: everyone can read, admins manage
CREATE POLICY "Authenticated users can view sections" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sections" ON public.sections FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- students: admins see all, teachers see assigned, parents see own children
CREATE POLICY "Admins can manage students" ON public.students FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view assigned students" ON public.students FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') AND
  EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
    AND ta.class_id = students.class_id
    AND ta.section_id = students.section_id
  )
);
CREATE POLICY "Parents can view own children" ON public.students FOR SELECT USING (
  public.has_role(auth.uid(), 'parent') AND parent_id = auth.uid()
);

-- subjects: everyone can read, admins manage
CREATE POLICY "Authenticated users can view subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- class_subjects: everyone can read, admins manage
CREATE POLICY "Authenticated users can view class_subjects" ON public.class_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage class_subjects" ON public.class_subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- teacher_assignments: admins manage, teachers see own
CREATE POLICY "Admins can manage teacher_assignments" ON public.teacher_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view own assignments" ON public.teacher_assignments FOR SELECT USING (teacher_id = auth.uid());

-- attendance: admins see all, teachers manage for assigned, parents see children
CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage assigned attendance" ON public.attendance FOR ALL USING (
  public.has_role(auth.uid(), 'teacher') AND
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teacher_assignments ta ON ta.class_id = s.class_id AND ta.section_id = s.section_id
    WHERE s.id = attendance.student_id AND ta.teacher_id = auth.uid()
  )
);
CREATE POLICY "Parents can view children attendance" ON public.attendance FOR SELECT USING (
  public.has_role(auth.uid(), 'parent') AND
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.parent_id = auth.uid())
);

-- marks: admins see all, teachers manage for assigned, parents see children
CREATE POLICY "Admins can manage marks" ON public.marks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage assigned marks" ON public.marks FOR ALL USING (
  public.has_role(auth.uid(), 'teacher') AND
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teacher_assignments ta ON ta.class_id = s.class_id AND ta.section_id = s.section_id
    WHERE s.id = marks.student_id AND ta.teacher_id = auth.uid()
  )
);
CREATE POLICY "Parents can view children marks" ON public.marks FOR SELECT USING (
  public.has_role(auth.uid(), 'parent') AND
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = marks.student_id AND s.parent_id = auth.uid())
);

-- assignments: admins see all, teachers manage for assigned, parents see children
CREATE POLICY "Admins can manage assignments" ON public.assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage assigned assignments" ON public.assignments FOR ALL USING (
  public.has_role(auth.uid(), 'teacher') AND
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teacher_assignments ta ON ta.class_id = s.class_id AND ta.section_id = s.section_id
    WHERE s.id = assignments.student_id AND ta.teacher_id = auth.uid()
  )
);
CREATE POLICY "Parents can view children assignments" ON public.assignments FOR SELECT USING (
  public.has_role(auth.uid(), 'parent') AND
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = assignments.student_id AND s.parent_id = auth.uid())
);

-- school_settings: everyone can read, admins manage
CREATE POLICY "Authenticated users can view settings" ON public.school_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.school_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default school settings
INSERT INTO public.school_settings (school_name, address, pass_percentage, academic_year)
VALUES ('Digital School System', 'Kathmandu, Nepal', 35, '2081/2082');

-- Insert default classes (ECD through 12)
INSERT INTO public.classes (name, numeric_level) VALUES
  ('ECD', 0), ('Class 1', 1), ('Class 2', 2), ('Class 3', 3),
  ('Class 4', 4), ('Class 5', 5), ('Class 6', 6), ('Class 7', 7),
  ('Class 8', 8), ('Class 9', 9), ('Class 10', 10), ('Class 11', 11), ('Class 12', 12);

-- Insert default sections for each class
INSERT INTO public.sections (name, class_id)
SELECT s.name, c.id FROM public.classes c
CROSS JOIN (VALUES ('A'), ('B')) AS s(name);

-- Insert 7 subjects per Nepalese curriculum
INSERT INTO public.subjects (name, code, credit_hours, th_full_marks, in_full_marks) VALUES
  ('Nepali', 'NEP', 4, 75, 25),
  ('English', 'ENG', 4, 75, 25),
  ('Mathematics', 'MATH', 5, 75, 25),
  ('Science', 'SCI', 4, 75, 25),
  ('Social Studies', 'SOC', 4, 75, 25),
  ('Health & Physical Education', 'HPE', 4, 75, 25),
  ('Hamro Kanchan', 'HK', 3, 75, 25);
