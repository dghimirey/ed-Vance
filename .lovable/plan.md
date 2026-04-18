
The user has several requests. Let me address each:

1. **"Failed to fetch" on login** — Per the lovable-stack-overflow context, this is a known preview-environment proxy issue with Supabase auth POST requests. Not a code bug. Solution: test on published URL. I'll communicate this clearly.

2. **Remove demo credentials text** & **make Login page more professional/attractive** — UI polish on `src/pages/Login.tsx`.

3. **Verify parent login flow** — Same fetch limitation in preview; will work on published URL.

4. **PDF export on Report Card** — Add jsPDF + html2canvas with an Export button on `src/pages/ReportCard.tsx`.

5. **Real-time notifications for parents** — Use Supabase realtime on `attendance` and `marks` tables filtered to selected child's id, show toasts via sonner. Need migration to add tables to `supabase_realtime` publication. Hook into ChildProvider or a dedicated hook used in AppLayout for parents.

Plan is concise.
