

# Parent Dashboard Redesign

## Problem
Currently, the parent experience is fragmented across separate pages (Dashboard, Report Card, Attendance, Assignments) with no unified view. The child switcher is a dropdown buried in individual pages. Parents need a single, rich dashboard showing all their child's data at a glance, with instant child switching.

## Approach

### 1. Create a global child context (`src/hooks/useChildContext.tsx`)
- A React context that holds the parent's children list and the currently selected child
- Fetches children once on mount for parent role users
- Provides `selectedChild` and `setSelectedChild` globally
- Persists selection in sessionStorage so it survives page navigation

### 2. Add a persistent child switcher in the sidebar/topbar
- For parent role: render clickable child name chips/tabs in the sidebar (below the logo area)
- Single click switches child instantly — no dropdown, no extra click
- Active child highlighted with primary color pill
- Shows child name + class info compactly

### 3. Redesign Parent Dashboard (`src/pages/Dashboard.tsx` — parent branch)
When `role === 'parent'`, the Dashboard renders a completely different layout showing:

**Row 1 — Stat Cards (4 cards):**
- Today's Attendance status (Present/Absent/Late/Leave with color badge)
- Today's Assignments (X/Y submitted)
- Overall GPA (or "NG")
- Attendance Rate (% present this term)

**Row 2 — Two columns:**
- **Left: Today's Details Card**
  - Attendance status for today with timestamp
  - List of today's assignments with ✓/✗ status per subject
- **Right: Performance Radar Chart** (reuse from ReportCard)
  - Subject-wise percentage radar

**Row 3 — Two columns:**
- **Subject Breakdown** — compact table showing each subject's TH/IN marks, grade, GP
- **Recent Attendance** — last 7 days as colored dots/calendar strip (P=green, A=red, L=yellow, Leave=gray)

### 4. Update parent sidebar navigation
Change parent sidebar items to:
- **Dashboard** (the new unified view) — `/`
- **Report Card** (detailed grades + radar) — `/report-card`
- **Attendance History** — `/attendance` (calendar heatmap view for parents, read-only)
- **Assignments** — `/assignments` (read-only view)
- **Analytics** — `/analytics` (risk score + trends for their child)

### 5. Make Attendance & Assignments pages parent-aware
- When role is parent, these pages auto-filter to the selected child (from context) instead of showing class/section selectors
- Attendance page shows a read-only calendar/list view
- Assignments page shows a read-only table of the child's assignments

## Files Changed
1. **New**: `src/hooks/useChildContext.tsx` — child selection context
2. **Edit**: `src/App.tsx` — wrap with ChildProvider for parents
3. **Edit**: `src/components/layout/AppSidebar.tsx` — add child switcher chips, update parent nav items
4. **Edit**: `src/pages/Dashboard.tsx` — add parent-specific dashboard with today's data
5. **Edit**: `src/pages/Attendance.tsx` — parent read-only mode using selected child
6. **Edit**: `src/pages/Assignments.tsx` — parent read-only mode using selected child
7. **Edit**: `src/pages/ReportCard.tsx` — use child context instead of local state
8. **Edit**: `src/pages/Analytics.tsx` — parent mode: show selected child's risk/trends

