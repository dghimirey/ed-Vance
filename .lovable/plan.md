
# Digital School System — Phase 1 Plan

## Overview
Build the core foundation of a modern academic management platform for Nepalese schools, featuring authentication, RBAC, student/class management, the Grade Ledger with full NG/GPA logic, attendance tracking, and a premium SaaS UI.

## Design System
- **Palette**: Soft neutrals (#f8fafc, #f1f5f9), deep indigo primary (#4f46e5), slate dark mode
- **Glassmorphism**: Semi-transparent cards with backdrop-blur, subtle borders, multi-stop gradient accents
- **Animations**: Fade-in, slide-up, scale-in keyframes on page transitions and card loads
- **Typography**: Clean sans-serif, clear hierarchy with muted secondary text

## Database Schema (Lovable Cloud / Supabase)
1. **user_roles** table (admin/teacher/parent roles, linked to auth.users)
2. **profiles** — name, email, phone, linked to auth.users
3. **classes** — name (ECD through 12), numeric_level
4. **sections** — name (A/B/C), linked to class
5. **students** — name, gender, DOB, father_name, symbol_number (unique per class), class_id, section_id, parent_id
6. **subjects** — name, credit_hours, th_percentage (75%), in_percentage (25%)
7. **class_subjects** — maps subjects to classes
8. **teacher_assignments** — teacher ↔ class/section mapping
9. **attendance** — student_id, date, status (Present/Absent/Late/Leave)
10. **marks** — student_id, subject_id, term, theory_marks, internal_marks, is_ng flag
11. **assignments** — student_id, subject_id, title, date, completed (boolean)
12. **school_settings** — school_name, pass_percentage, grading scales

All tables with UUID PKs, RLS policies, and proper foreign keys.

## Pages & Features

### 1. Auth & Layout
- Login page (email/password) with glassmorphism card
- Role-based sidebar navigation (Admin sees all, Teacher sees assigned classes, Parent sees children)
- Top bar with school name, user avatar, role badge
- Dark mode toggle

### 2. Admin Dashboard
- **Overview**: Stat cards (total students, teachers, attendance rate today, at-risk count) with animated counters and sparklines
- **User Management**: CRUD for teachers and parents, role assignment
- **Student Management**: Full CRUD, bulk Excel upload (SheetJS), assign parents (up to 5 children per parent)
- **Class/Section/Subject Config**: Manage classes ECD-12, sections, subjects with credit hours
- **School Settings**: School name, pass percentage, grading scale configuration

### 3. Grade Ledger (Critical Feature)
- Professional nested table: Row 1 = Subject names + Totals columns, Row 2 = TH/IN splits
- 7 subjects: Nepali, English, Mathematics, Science, Social, Health, Hamro Kanchan
- Frozen first 3 columns (S.No, Name, Symbol Number) with horizontal scroll
- Sticky headers, alternating rows, hover highlights
- Auto-calculate: Subject GP, Final GPA, Letter Grade per Nepalese Directive 2078
- NG flagging: <35% TH or <40% IN → NG for that subject → Final GPA shows "NG"
- Leaderboard ranking by total marks (NG students excluded), ties broken by symbol_number
- Export to PDF and Excel

### 4. Teacher Module
- **Attendance Grid**: Rapid-entry matrix (students × dates), color-coded status buttons
- **Marks Entry**: Bulk entry grid for TH/IN per subject, Excel template download/upload
- **Assignment Tracker**: Matrix table with 1-click toggle (Completed/Pending)
- **At-Risk Indicators**: Risk score badges on student rows

### 5. Parent Module
- Multi-child switcher (dropdown/tabs)
- **Report Card**: Visual GPA display with donut charts per subject, radar chart for overall performance
- **Attendance Calendar**: Heatmap view showing present/absent/late patterns
- **Assignment Overview**: Consistency bars per subject
- Notification banners for <75% attendance or grade drops

### 6. Analytics
- **At-Risk Detection**: Risk Score = 0.5*(100-Marks%) + 0.3*(100-Attendance%) + 0.2*(100-Assignment%). Color-coded High/Medium/Low
- **Trend Analysis**: Term-over-term GPA comparison with Improving/Declining/Stable flags
- **Class Performance Charts**: Bar/line charts via Recharts

### 7. Promotion System
- Admin view: All students with pass/fail status based on TH/IN thresholds
- "Promote All Eligible" bulk action
- Individual override options

## Seed Data
- 1 Admin, 2 Teachers, 3 Parents, 10 Students with symbol numbers
- Pre-populated marks (TH + IN) for all 7 subjects
- Sample attendance and assignment data
- Demonstrates Ledger, NG logic, GPA calculations immediately

## Key Technical Details
- SheetJS for Excel import/export, jsPDF + html2canvas for PDF export
- date-fns for date handling
- Recharts for all charts
- RLS policies ensuring teachers only see their assigned classes, parents only see their children
- Security definer functions for role checks (no recursive RLS)
