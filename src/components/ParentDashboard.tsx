import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useChildContext } from '@/hooks/useChildContext';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, BookOpen, Award, TrendingUp, CheckCircle, XCircle, AlertTriangle, Sparkles, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { calculateSubjectGP, calculateFinalGPA } from '@/lib/grading';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

const statusConfig: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present: { label: 'Present', color: 'text-success', bg: 'bg-success' },
  absent: { label: 'Absent', color: 'text-destructive', bg: 'bg-destructive' },
  late: { label: 'Late', color: 'text-warning', bg: 'bg-warning' },
  leave: { label: 'Leave', color: 'text-muted-foreground', bg: 'bg-muted-foreground' },
};

interface Subject { id: string; name: string; code: string; credit_hours: number; th_full_marks: number; in_full_marks: number }
interface Mark { subject_id: string; theory_marks: number; internal_marks: number }
interface Assignment { id: string; subject_id: string; title: string; completed: boolean; assigned_date: string }
interface AttendanceRow { date: string; status: AttendanceStatus }

export default function ParentDashboard() {
  const { selectedChild } = useChildContext();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceStatus | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRow[]>([]);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);

    const fetchAll = async () => {
      const [subRes, markRes, attRes, assRes, allAttRes] = await Promise.all([
        supabase.from('subjects').select('*').order('name'),
        supabase.from('marks').select('subject_id, theory_marks, internal_marks').eq('student_id', selectedChild.id),
        supabase.from('attendance').select('date, status').eq('student_id', selectedChild.id).order('date', { ascending: false }).limit(30),
        supabase.from('assignments').select('id, subject_id, title, completed, assigned_date').eq('student_id', selectedChild.id),
        supabase.from('attendance').select('status').eq('student_id', selectedChild.id),
      ]);

      setSubjects((subRes.data || []) as Subject[]);
      setMarks((markRes.data || []) as Mark[]);
      setAssignments((assRes.data || []) as Assignment[]);

      const attData = (attRes.data || []) as AttendanceRow[];
      setRecentAttendance(attData);

      const todayRec = attData.find(a => a.date === today);
      setTodayAttendance(todayRec?.status ?? null);

      // Calculate attendance rate
      const allAtt = allAttRes.data || [];
      if (allAtt.length > 0) {
        const presentCount = allAtt.filter(a => a.status === 'present' || a.status === 'late').length;
        setAttendanceRate(Math.round((presentCount / allAtt.length) * 100));
      } else {
        setAttendanceRate(0);
      }

      setLoading(false);
    };

    fetchAll();
  }, [selectedChild, today]);

  if (!selectedChild) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center text-muted-foreground">
          No children linked to your account
        </CardContent>
      </Card>
    );
  }

  // GPA calculation
  const subjectResults = subjects.map(s => {
    const m = marks.find(mk => mk.subject_id === s.id);
    return {
      ...calculateSubjectGP(
        m?.theory_marks ?? 0, s.th_full_marks,
        m?.internal_marks ?? 0, s.in_full_marks,
        s.credit_hours
      ),
      subject: s,
      mark: m,
    };
  });

  const finalGPA = calculateFinalGPA(
    subjectResults.map(r => ({ gp: r.gp, isNG: r.isNG, creditHours: r.subject.credit_hours }))
  );

  // Today's assignments
  const todayAssignments = assignments.filter(a => a.assigned_date === today);
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter(a => a.completed).length;

  // Radar data
  const radarData = subjectResults.map(r => ({
    subject: r.subject.name.substring(0, 6),
    percentage: Math.round(r.percentage),
  }));

  // Last 7 days attendance
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const record = recentAttendance.find(a => a.date === date);
    return { date, day: format(subDays(new Date(), 6 - i), 'EEE'), status: record?.status ?? null };
  });

  // === SMART INSIGHTS (heuristics) ===
  type Insight = { tone: 'positive' | 'warning' | 'negative' | 'info'; icon: typeof Sparkles; title: string; detail: string };
  const insights: Insight[] = [];

  // Attendance trend: last 7d vs prior 7d
  const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const recent = recentAttendance.filter(a => a.date >= cutoff);
  const prior = recentAttendance.filter(a => a.date < cutoff);
  const rate = (rows: typeof recentAttendance) => {
    if (rows.length === 0) return null;
    const p = rows.filter(r => r.status === 'present' || r.status === 'late').length;
    return (p / rows.length) * 100;
  };
  const rNow = rate(recent), rPrev = rate(prior);
  if (rNow !== null && rPrev !== null) {
    const delta = Math.round(rNow - rPrev);
    if (delta >= 5) insights.push({ tone: 'positive', icon: ArrowUpRight, title: 'Attendance improved', detail: `Up ${delta}% vs previous week` });
    else if (delta <= -5) insights.push({ tone: 'negative', icon: ArrowDownRight, title: 'Attendance decreased', detail: `Down ${Math.abs(delta)}% this week` });
  }

  // Weak subjects
  const weak = subjectResults.filter(r => r.percentage < 50 && (r.mark?.theory_marks ?? 0) + (r.mark?.internal_marks ?? 0) > 0);
  if (weak.length > 0) {
    insights.push({
      tone: 'warning',
      icon: AlertTriangle,
      title: `${weak[0].subject.name} needs attention`,
      detail: `Currently at ${weak[0].percentage.toFixed(0)}%${weak.length > 1 ? ` · +${weak.length - 1} more` : ''}`,
    });
  }

  // Strong subject
  const strong = [...subjectResults].sort((a, b) => b.percentage - a.percentage)[0];
  if (strong && strong.percentage >= 80) {
    insights.push({ tone: 'positive', icon: Sparkles, title: `Excellent in ${strong.subject.name}`, detail: `Scoring ${strong.percentage.toFixed(0)}%` });
  }

  // Assignment completion
  if (totalAssignments > 0) {
    const compRate = (completedAssignments / totalAssignments) * 100;
    if (compRate < 60) insights.push({ tone: 'warning', icon: BookOpen, title: 'Assignment pace lagging', detail: `${Math.round(compRate)}% completed overall` });
    else if (compRate >= 90) insights.push({ tone: 'positive', icon: CheckCircle, title: 'Assignments on track', detail: `${Math.round(compRate)}% completion rate` });
  }

  if (insights.length === 0) {
    insights.push({ tone: 'info', icon: Sparkles, title: 'All steady', detail: 'No significant changes detected this week' });
  }

  // === TIMELINE (last 10 events: attendance + marks recency proxy via assignments) ===
  type TimelineItem = { time: number; icon: typeof CalendarCheck; title: string; detail: string; tone: string };
  const timeline: TimelineItem[] = [];
  recentAttendance.slice(0, 8).forEach(a => {
    timeline.push({
      time: new Date(a.date).getTime(),
      icon: CalendarCheck,
      title: `Marked ${a.status}`,
      detail: format(new Date(a.date), 'EEE, dd MMM yyyy'),
      tone: a.status === 'present' ? 'text-success bg-success/10'
        : a.status === 'absent' ? 'text-destructive bg-destructive/10'
        : a.status === 'late' ? 'text-warning bg-warning/10'
        : 'text-muted-foreground bg-muted',
    });
  });
  assignments.slice(0, 4).forEach(a => {
    timeline.push({
      time: new Date(a.assigned_date).getTime(),
      icon: BookOpen,
      title: a.title,
      detail: `${subjects.find(s => s.id === a.subject_id)?.name || 'Assignment'} · ${a.completed ? 'Completed' : 'Pending'}`,
      tone: a.completed ? 'text-success bg-success/10' : 'text-warning bg-warning/10',
    });
  });
  timeline.sort((x, y) => y.time - x.time);
  const timelineSlice = timeline.slice(0, 10);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{selectedChild.name}'s Dashboard</h1>
        <p className="text-muted-foreground">
          {selectedChild.class_name} — {selectedChild.section_name} · Symbol #{selectedChild.symbol_number}
        </p>
      </div>

      {/* Smart Insights */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {insights.slice(0, 4).map((ins, i) => {
          const Icon = ins.icon;
          const toneClass =
            ins.tone === 'positive' ? 'border-success/30 bg-success/5'
            : ins.tone === 'warning' ? 'border-warning/30 bg-warning/5'
            : ins.tone === 'negative' ? 'border-destructive/30 bg-destructive/5'
            : 'border-border bg-muted/30';
          const iconClass =
            ins.tone === 'positive' ? 'bg-success/15 text-success'
            : ins.tone === 'warning' ? 'bg-warning/15 text-warning'
            : ins.tone === 'negative' ? 'bg-destructive/15 text-destructive'
            : 'bg-primary/10 text-primary';
          return (
            <div
              key={i}
              className={cn('rounded-2xl border p-4 flex gap-3 card-hover animate-slide-up', toneClass)}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', iconClass)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ins.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 1 — Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Attendance"
          value={todayAttendance ? statusConfig[todayAttendance].label : 'Not Recorded'}
          icon={<CalendarCheck className={cn('w-6 h-6', todayAttendance ? statusConfig[todayAttendance].color : 'text-muted-foreground')} />}
          delay={0}
        />
        <StatCard
          title="Assignments"
          value={`${completedAssignments}/${totalAssignments}`}
          icon={<BookOpen className="w-6 h-6 text-primary" />}
          description="Completed"
          delay={100}
        />
        <StatCard
          title="GPA"
          value={finalGPA.hasNG ? 'NG' : (finalGPA.gpa?.toFixed(2) ?? '—')}
          icon={<Award className={cn('w-6 h-6', finalGPA.hasNG ? 'text-destructive' : 'text-primary')} />}
          delay={200}
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          icon={<TrendingUp className="w-6 h-6 text-primary" />}
          description="Overall"
          delay={300}
        />
      </div>

      {/* Row 2 — Today + Radar */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass animate-slide-up" style={{ animationDelay: '400ms' }}>
          <CardHeader><CardTitle className="text-lg">Today's Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <CalendarCheck className={cn('w-5 h-5', todayAttendance ? statusConfig[todayAttendance].color : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-medium">Attendance</p>
                <p className="text-xs text-muted-foreground">
                  {todayAttendance ? (
                    <Badge className={cn('text-xs', statusConfig[todayAttendance].bg, 'text-white')}>
                      {statusConfig[todayAttendance].label}
                    </Badge>
                  ) : 'Not yet recorded'}
                </p>
              </div>
            </div>

            {todayAssignments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Today's Assignments</p>
                {todayAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      {a.completed ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-sm">{a.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {subjects.find(s => s.id === a.subject_id)?.code || ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No assignments today</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass animate-slide-up" style={{ animationDelay: '500ms' }}>
          <CardHeader><CardTitle className="text-lg">Performance Radar</CardTitle></CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="%" dataKey="percentage" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">No marks data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Subject Breakdown + Attendance Strip */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass animate-slide-up" style={{ animationDelay: '600ms' }}>
          <CardHeader><CardTitle className="text-lg">Subject Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subjectResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{r.subject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      TH: {r.mark?.theory_marks ?? 0}/{r.subject.th_full_marks} · IN: {r.mark?.internal_marks ?? 0}/{r.subject.in_full_marks}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">GP: {r.gp.toFixed(1)}</span>
                    <Badge variant={r.isNG ? 'destructive' : 'secondary'} className="text-xs">
                      {r.grade.letter}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass animate-slide-up" style={{ animationDelay: '700ms' }}>
          <CardHeader><CardTitle className="text-lg">Recent Attendance</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 justify-between mb-4">
              {last7Days.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-medium text-white',
                      d.status === 'present' ? 'bg-success' :
                      d.status === 'absent' ? 'bg-destructive' :
                      d.status === 'late' ? 'bg-warning' :
                      d.status === 'leave' ? 'bg-muted-foreground' :
                      'bg-muted border-2 border-dashed border-border text-muted-foreground'
                    )}
                  >
                    {d.status ? d.status.charAt(0).toUpperCase() : '—'}
                  </div>
                  <span className="text-[9px] text-muted-foreground">{format(new Date(d.date), 'dd')}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
              {Object.entries(statusConfig).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={cn('w-2.5 h-2.5 rounded-full', val.bg)} />
                  <span className="text-muted-foreground capitalize">{val.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
