

# Phase 2 — Mapping, Access Control & Ledger Fix

## 1. Grade Ledger Scroll Fix (`src/pages/GradeLedger.tsx`)
Replace fragile `sticky left-[Npx]` + `bg-inherit` pattern with a robust two-pane layout:
- Wrap table in a container; freeze the first 3 columns (S.No / Name / Symbol) using a separate left-pinned table OR proper `sticky` with explicit solid background per row state (not inherit).
- Use solid `bg-card` on sticky cells and add a **right-edge shadow** on the frozen pane that appears only when scrolled (`box-shadow: inset -8px 0 8px -8px hsl(var(--border))`).
- Apply `min-w` per data column so columns never collapse/overlap.
- Style the horizontal scrollbar (`scrollbar-thin scrollbar-thumb-border`) and add fade-mask on the right edge as a visual scroll affordance.
- Keep zebra stripes by setting bg on `<td>` directly (not inherited).

## 2. Student–Parent Many-to-Many Mapping
**DB migration:**
- New table `student_parents (id, student_id, parent_id, relation, created_at)` — unique on `(student_id, parent_id)`.
- Backfill existing `students.parent_id` rows into `student_parents`.
- Keep `students.parent_id` for now (legacy) but new code reads `student_parents`.
- RLS on `student_parents`: admins manage; parents/teachers SELECT relevant rows.
- Update RLS on `students`, `attendance`, `marks`, `assignments` parent SELECT policies to use `EXISTS(SELECT 1 FROM student_parents sp WHERE sp.student_id=... AND sp.parent_id=auth.uid())` (replaces `s.parent_id = auth.uid()`).
- Update `useChildContext` to query via `student_parents` join so a parent sees ALL their assigned children.

**UI:** New "Parents" section on Students page row → "Manage Parents" dialog (multi-select parents from `user_roles` where role='parent').

## 3. Teacher–Class Assignment UI (`ClassManagement.tsx`)
New "Teacher Assignments" card listing all teachers with a button to assign class+section. Backed by existing `teacher_assignments` table. Admin can add/remove rows. Multi-class per teacher supported.

## 4. Student Visibility / Unassigned Handling
- Admin Students page: add filter chip **"Unassigned"** (students where no teacher has matching `teacher_assignments` row for their class+section). Computed client-side.
- Add a banner "X students have no assigned teacher" linking to Class Management.
- Confirm teacher view: existing RLS is correct; verify `Students.tsx` query works for teachers (it does — RLS filters automatically). Add empty state message: "No students visible. Ask admin to assign you to a class."

## 5. Real-Time Sync
Enable realtime publication on `students`, `teacher_assignments`, `student_parents`. Subscribe in `Students.tsx`, `ClassManagement.tsx`, and `useChildContext` so updates reflect across dashboards instantly.

## 6. Security Verification
- RLS on new `student_parents` table.
- Update parent-related RLS on 4 tables (`students`, `attendance`, `marks`, `assignments`) to honor multi-parent mapping.
- All access enforced server-side via RLS — UI is defense-in-depth only.

## Files Changed
- **Migration**: create `student_parents` + RLS + backfill + update parent policies on 4 tables + realtime publication
- **New**: `src/components/ManageParentsDialog.tsx`, `src/components/TeacherAssignmentsCard.tsx`
- **Edit**: `src/pages/GradeLedger.tsx` (ledger fix), `src/pages/Students.tsx` (unassigned filter, manage parents button), `src/pages/ClassManagement.tsx` (mount teacher assignments card), `src/hooks/useChildContext.tsx` (use student_parents), `src/index.css` (scrollbar styling utility)

## Notes
- Migration is additive; existing `parent_id` column stays intact for backward compatibility.
- Parent dashboard already supports multiple children via switcher — this just makes the data model match.

