

# Plan — Audit Popover, Fix Visibility, Access Audit Page

## 1. Diagnose & fix "no students visible" for teachers
**Root cause confirmed via DB**: The two `teacher_assignments` rows point to `class_id=463af1af…` / `section_id=ef06f658…`, but **all 12 actual students belong to different classes** (Class 10 sec A/B, Class 9 sec A) with completely different IDs. So teachers correctly see nothing — this is a data mismatch, not a bug.

Admin sees all 12 students by RLS, so if admin also sees nothing, the likely cause is a stale "Unassigned" filter being on, or they were viewing the teacher account.

**Fix**:
- Add a one-click **"Reassign Teachers to Real Classes"** helper inside the existing Teacher Assignments card: when admin clicks a row, it shows the real student-bearing classes prominently (sorted by student count) so misassignment is obvious.
- Show **student count badge per class+section** in the assignment dialog: "Class 10 / A (10 students)" — makes wrong picks impossible.
- On Students page, when admin has zero results, show a clearer empty state explaining if filters are applied.

## 2. Relationships popover on Students table row
On each student row in `src/pages/Students.tsx`, replace the current "Manage / N linked" cell with a **HoverCard/Popover trigger** showing:
- **Linked Parents**: name + email + relation (from `student_parents` joined to `profiles`)
- **Assigned Teachers**: name + email of every teacher whose `teacher_assignments` matches this student's class+section
- Footer button: "Manage Parents" (opens existing dialog)

Empty states: "No parents linked" / "No teacher assigned" with amber warning icon.

## 3. New page: `/access-audit` (admin only)
**File**: `src/pages/AccessAudit.tsx` + route in `App.tsx` + sidebar link in `AppSidebar.tsx` (admin only, icon: `ShieldCheck`).

**Layout**:
- Summary strip: Total Students | Students with Parents | Students with Teachers | Fully Linked | Orphaned (no parent AND no teacher)
- Filterable table: Student | Class | Section | Linked Parents (chip list) | Assigned Teachers (chip list) | Status (Fully Linked / Missing Parent / Missing Teacher / Orphaned)
- Filters: search, class dropdown, status dropdown
- **CSV export** button (build CSV client-side from filtered rows, columns: Student Name, Symbol, Class, Section, Parents, Teachers, Status)

**Data**: single batch fetch of `students`, `student_parents` + parent profiles, `teacher_assignments` + teacher profiles, `classes`, `sections`. Compose in-memory.

## 4. End-to-end test guidance (preview limitation)
Login fails in preview iframe ("Failed to fetch") but works on **published URL**. After this round, user should:
1. Publish the app
2. Login as admin → go to **Access Audit** → identify orphaned/missing-teacher students → fix via Manage Parents popover and Teacher Assignments card
3. Login as `parent1@school.edu.np` → confirm only their 3 linked children appear
4. Login as `teacher1@school.edu.np` → confirm students from their assigned class+section appear

## Files
- **Edit**: `src/pages/Students.tsx` (add relationships popover, better empty state), `src/components/TeacherAssignmentsCard.tsx` (show student-count badges per class+section), `src/App.tsx` (route), `src/components/layout/AppSidebar.tsx` (admin link)
- **New**: `src/pages/AccessAudit.tsx`

No DB migrations needed.

