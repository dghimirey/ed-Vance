

# Digital School System — UI/UX Enhancement & Feature Pack

## Scope Strategy
The user listed 9 categories. I'll bundle into **4 phases**, with **Phase 1** delivered in this round (highest visual + functional impact). Subsequent phases are queued as suggestion buttons after delivery — keeps each round shippable and reviewable.

## Phase 1 — This Round (Design system + Notifications + PDF + Dashboards)

### 1. Design System Refresh (`src/index.css`, `tailwind.config.ts`)
- Refine palette to: **Indigo primary** (already), **Emerald success**, **Amber warning** (already close — tighten saturation).
- Add gradient utility classes (`.bg-gradient-primary`, `.glow-soft`, `.glow-intense`) for gamification glow.
- Add `.card-hover` (lift + shadow), `.shimmer` skeleton class, smoother transitions.
- Tighten radii to 14–18px range. Heavier glassmorphism in dark mode.

### 2. Notification Bell (`src/components/NotificationBell.tsx` — NEW)
- Topbar dropdown (Popover) with notification history.
- Stores notifications client-side in `localStorage` keyed by user (avoids new DB table this round).
- Hooks into `useParentNotifications` → instead of just toast, also pushes to the bell store.
- Read/unread visual states, timestamp via `date-fns` `formatDistanceToNow`, smooth scale-in animation.
- Unread count badge on bell icon with pulse animation.

### 3. Enhanced PDF Report Card (`src/pages/ReportCard.tsx`)
Replace `html2canvas` snapshot with a **structured `jsPDF` document** for crisp, official output:
- **Header**: school name (bold centered), academic year subtitle, divider line. Logo placeholder (circle with initial) on left.
- **Student details block**: 2-column grid (Name, Class/Section, Symbol No, DOB).
- **Marks table**: bordered table via `jspdf-autotable` (already installable) with subject, TH, IN, Total, %, Grade, GP. NG rows highlighted amber.
- **Summary block**: GPA, Overall Grade, Total Marks, Result (Pass/NG).
- **Footer**: signature lines (Class Teacher / Principal), date, "School Stamp" placeholder box.

### 4. Admin/Teacher Dashboard Upgrade (`src/pages/Dashboard.tsx`)
- Live "Today's Attendance" stat (real query, not 0).
- "At-Risk Students" stat with real count from risk calc.
- New **Subject Performance** bar chart (avg % per subject across all students).
- New **Monthly Comparison** multi-line chart (First Term vs Second Term vs Final — uses `marks.term`).
- Trend arrows (▲ green / ▼ red) on stat cards using simple period-over-period delta.

### 5. Parent Dashboard Polish (`src/components/ParentDashboard.tsx`)
- Add **Smart Insight Cards** strip: auto-generated messages like "Math performance dropping" / "Attendance improved" based on simple heuristics over `marks` and `attendance`.
- Add **timeline view** (last 10 events: attendance marks + grade updates) using existing data.

## Phase 2+ — Queued as Suggestions
- Gamification UI (streaks, badges, glow progress bars)
- Goal Tracking (new table + UI)
- Heatmaps for weak subjects
- Settings page redesign with toggle switches & sectioned layout
- Table/form polish (striped rows, floating labels, skeletons everywhere)

## Files Changed (Phase 1)
- **New**: `src/components/NotificationBell.tsx`, `src/hooks/useNotificationStore.tsx`
- **Edit**: `src/index.css`, `tailwind.config.ts`, `src/components/layout/AppLayout.tsx` (mount bell), `src/hooks/useParentNotifications.tsx` (push to store), `src/pages/ReportCard.tsx` (jspdf-autotable rewrite), `src/pages/Dashboard.tsx` (charts + live data), `src/components/ParentDashboard.tsx` (insights + timeline)
- **Add dep**: `jspdf-autotable`

## Technical Notes
- Notification store: `localStorage` with max 50 items, hydrated on mount, in-memory React state for reactivity. Avoids schema changes; can graduate to DB table later.
- Trend calculations: compare current term marks to previous term where available; if only one term exists, hide arrow.
- Insights: pure client-side heuristics (e.g., subject avg < 50% → "needs attention"; attendance last 7d vs prior 7d → trend).
- All charts use Recharts with theme tokens (`hsl(var(--primary))` etc).

