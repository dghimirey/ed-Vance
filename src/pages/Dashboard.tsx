import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StatCard } from '@/components/StatCard';
import { Users, GraduationCap, CalendarCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ParentDashboard from '@/components/ParentDashboard';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import { calculateSubjectGP } from '@/lib/grading';

interface Subject { id: string; name: string; th_full_marks: number; in_full_marks: number; credit_hours: number }
interface MarkRow { student_id: string; subject_id: string; theory_marks: number | null; internal_marks: number | null; term: string }

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, presentToday: 0, totalToday: 0, atRisk: 0 });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<number | undefined>(undefined);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (role === 'parent') return;

    const fetchData = async () => {
      const [studentsRes, teachersRes, todayAtt, subRes, markRes, weekAtt] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('subjects').select('id, name, th_full_marks, in_full_marks, credit_hours'),
        supabase.from('marks').select('student_id, subject_id, theory_marks, internal_marks, term'),
        supabase.from('attendance').select('date, status').gte('date', format(new Date(Date.now() - 14 * 86400000), 'yyyy-MM-dd')),
      ]);

      const todayData = todayAtt.data || [];
      const present = todayData.filter(a => a.status === 'present' || a.status === 'late').length;

      const subjectsData = (subRes.data || []) as Subject[];
      const marksData = (markRes.data || []) as MarkRow[];
      setSubjects(subjectsData);
      setMarks(marksData);

      // At-risk: students whose avg % across subjects < 40
      const studentMap = new Map<string, { total: number; max: number }>();
      marksData.forEach(m => {
        const sub = subjectsData.find(s => s.id === m.subject_id);
        if (!sub) return;
        const cur = studentMap.get(m.student_id) || { total: 0, max: 0 };
        cur.total += (m.theory_marks ?? 0) + (m.internal_marks ?? 0);
        cur.max += sub.th_full_marks + sub.in_full_marks;
        studentMap.set(m.student_id, cur);
      });
      let atRisk = 0;
      studentMap.forEach(({ total, max }) => {
        if (max > 0 && (total / max) * 100 < 40) atRisk += 1;
      });

      // Attendance trend: last 7d vs prior 7d
      const weekData = weekAtt.data || [];
      const cutoff = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd');
      const recent = weekData.filter(a => a.date >= cutoff);
      const prior = weekData.filter(a => a.date < cutoff);
      const rate = (rows: typeof weekData) => {
        if (rows.length === 0) return null;
        const p = rows.filter(r => r.status === 'present' || r.status === 'late').length;
        return (p / rows.length) * 100;
      };
      const r = rate(recent), p = rate(prior);
      const trend = r !== null && p !== null && p > 0 ? Math.round(r - p) : undefined;
      setAttendanceTrend(trend);

      setStats({
        students: studentsRes.count ?? 0,
        teachers: teachersRes.count ?? 0,
        presentToday: present,
        totalToday: todayData.length,
        atRisk,
      });
    };

    fetchData();
  }, [role, today]);

  const subjectPerformance = useMemo(() => {
    return subjects.map(s => {
      const subjMarks = marks.filter(m => m.subject_id === s.id);
      if (subjMarks.length === 0) return { name: s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name, avg: 0 };
      const sum = subjMarks.reduce((acc, m) => {
        const r = calculateSubjectGP(m.theory_marks ?? 0, s.th_full_marks, m.internal_marks ?? 0, s.in_full_marks, s.credit_hours);
        return acc + r.percentage;
      }, 0);
      return { name: s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name, avg: Math.round(sum / subjMarks.length) };
    });
  }, [subjects, marks]);

  const termComparison = useMemo(() => {
    const terms = ['First Term', 'Second Term', 'Final Term'];
    return subjects.slice(0, 6).map(s => {
      const row: Record<string, string | number> = { name: s.name.length > 8 ? s.name.slice(0, 8) + '…' : s.name };
      terms.forEach(t => {
        const tm = marks.filter(m => m.subject_id === s.id && m.term === t);
        if (tm.length === 0) { row[t] = 0; return; }
        const sum = tm.reduce((acc, m) => {
          const r = calculateSubjectGP(m.theory_marks ?? 0, s.th_full_marks, m.internal_marks ?? 0, s.in_full_marks, s.credit_hours);
          return acc + r.percentage;
        }, 0);
        row[t] = Math.round(sum / tm.length);
      });
      return row;
    });
  }, [subjects, marks]);

  const attendancePct = stats.totalToday > 0 ? Math.round((stats.presentToday / stats.totalToday) * 100) : 0;

  if (role === 'parent') return <ParentDashboard />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {role === 'admin' ? 'School overview and performance insights' : 'Your class overview'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={stats.students} icon={<GraduationCap className="w-5 h-5" />} delay={0} />
        <StatCard title="Teachers" value={stats.teachers} icon={<Users className="w-5 h-5" />} delay={100} />
        <StatCard
          title="Attendance Today"
          value={`${attendancePct}%`}
          description={`${stats.presentToday} / ${stats.totalToday} present`}
          icon={<CalendarCheck className="w-5 h-5" />}
          trend={attendanceTrend}
          delay={200}
        />
        <StatCard
          title="At-Risk Students"
          value={stats.atRisk}
          description="Avg below 40%"
          icon={<AlertTriangle className="w-5 h-5" />}
          delay={300}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass animate-slide-up" style={{ animationDelay: '400ms' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Subject Performance</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Avg %</Badge>
          </CardHeader>
          <CardContent>
            {subjectPerformance.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass animate-slide-up" style={{ animationDelay: '500ms' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Term Comparison</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Avg %</Badge>
          </CardHeader>
          <CardContent>
            {termComparison.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={termComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="First Term" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Second Term" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Final Term" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass animate-slide-up" style={{ animationDelay: '600ms' }}>
        <CardHeader><CardTitle className="text-lg">Grading Reference</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
            {[
              { grade: 'A+', range: '90%+', gp: '4.0', tone: 'bg-success/15 text-success' },
              { grade: 'A', range: '80–89%', gp: '3.6', tone: 'bg-success/10 text-success' },
              { grade: 'B+', range: '70–79%', gp: '3.2', tone: 'bg-primary/15 text-primary' },
              { grade: 'B', range: '60–69%', gp: '2.8', tone: 'bg-primary/10 text-primary' },
              { grade: 'C+', range: '50–59%', gp: '2.4', tone: 'bg-warning/15 text-warning' },
              { grade: 'C', range: '40–49%', gp: '2.0', tone: 'bg-warning/10 text-warning' },
              { grade: 'D', range: '35–39%', gp: '1.6', tone: 'bg-muted text-muted-foreground' },
              { grade: 'NG', range: '<35%', gp: '0.0', tone: 'bg-destructive/15 text-destructive' },
            ].map(g => (
              <div key={g.grade} className={`rounded-xl px-3 py-2 ${g.tone}`}>
                <div className="font-bold text-sm">{g.grade}</div>
                <div className="text-[10px] opacity-80">{g.range}</div>
                <div className="text-[10px] opacity-80">GP {g.gp}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
