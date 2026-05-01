import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, X, RotateCcw, AlertTriangle } from 'lucide-react';

type Status = 'present' | 'absent' | 'late' | 'leave';

const statusColors: Record<Status, string> = {
  present: 'bg-success text-success-foreground',
  absent: 'bg-destructive text-destructive-foreground',
  late: 'bg-warning text-warning-foreground',
  leave: 'bg-muted text-muted-foreground',
};

export default function Attendance() {
  const { role } = useAuth();

  if (role === 'parent') {
    return <ParentAttendanceView />;
  }

  return <TeacherAdminAttendance />;
}

function TeacherAdminAttendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; symbol_number: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<Map<string, Status | undefined>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
    ]).then(([c, s]) => {
      if (c.data) setClasses(c.data);
      if (s.data) setSections(s.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    supabase.from('students')
      .select('id, name, symbol_number')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .order('symbol_number')
      .then(({ data }) => {
        setStudents(data || []);
        if (data && data.length > 0) {
          supabase.from('attendance')
            .select('student_id, status')
            .in('student_id', data.map(s => s.id))
            .eq('date', selectedDate)
            .then(({ data: attData }) => {
              const map = new Map<string, Status>();
              (attData || []).forEach((a: any) => map.set(a.student_id, a.status));
              // Pre-fill with previously saved values; leave others undefined (unmarked)
              setAttendance(map);
            });
        } else {
          setAttendance(new Map());
        }
      });
  }, [selectedClass, selectedSection, selectedDate]);

  const setStatus = (studentId: string, status: Status | undefined) => {
    const next = new Map(attendance);
    if (status === undefined) next.delete(studentId);
    else next.set(studentId, status);
    setAttendance(next);
  };

  const markAll = (status: Status) => {
    const next = new Map<string, Status>();
    students.forEach(s => next.set(s.id, status));
    setAttendance(next);
  };

  const resetAll = () => setAttendance(new Map());

  const unmarkedCount = students.filter(s => !attendance.get(s.id)).length;

  const saveAttendance = async () => {
    if (students.length === 0) {
      toast.warning('No students to save', { description: 'Select a class and section first.' });
      return;
    }
    if (unmarkedCount > 0) {
      toast.error('Please mark attendance for all students before submitting', {
        description: `${unmarkedCount} student${unmarkedCount === 1 ? ' is' : 's are'} still unmarked. Use "Present All" to fill quickly, then adjust absent students.`,
      });
      return;
    }
    setSaving(true);
    const records = students.map(s => ({
      student_id: s.id,
      date: selectedDate,
      status: attendance.get(s.id) as Status,
      recorded_by: user?.id,
    }));

    const { error } = await supabase.from('attendance')
      .upsert(records, { onConflict: 'student_id,date' });

    if (error) {
      toast.error('Unable to save attendance', {
        description: error.message.includes('row-level security')
          ? 'You do not have permission to record attendance for this class.'
          : `Database rejected the save: ${error.message}`,
      });
    } else {
      toast.success('Attendance submitted successfully', {
        description: `${records.length} record${records.length === 1 ? '' : 's'} saved for ${format(new Date(selectedDate), 'MMM d, yyyy')}.`,
      });
    }
    setSaving(false);
  };

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const presentCount = [...attendance.values()].filter(s => s === 'present').length;
  const absentCount = [...attendance.values()].filter(s => s === 'absent').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Mark each student as Present or Absent. Submission is blocked until everyone is marked.</p>
        </div>
        <Button onClick={saveAttendance} disabled={saving || students.length === 0}>
          {saving ? 'Saving...' : 'Submit Attendance'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection(''); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        {students.length > 0 && (
          <>
            <Badge variant="secondary" className="h-10 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-success" /> {presentCount}
            </Badge>
            <Badge variant="secondary" className="h-10 flex items-center gap-1.5">
              <X className="w-3 h-3 text-destructive" /> {absentCount}
            </Badge>
            <Badge variant={unmarkedCount > 0 ? 'destructive' : 'secondary'} className="h-10 flex items-center gap-1.5">
              {unmarkedCount > 0 && <AlertTriangle className="w-3 h-3" />}
              Unmarked: {unmarkedCount}
            </Badge>
          </>
        )}
      </div>

      {students.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => markAll('present')}>
            <Check className="w-4 h-4 mr-1 text-success" /> Present All
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAll('absent')}>
            <X className="w-4 h-4 mr-1 text-destructive" /> Absent All
          </Button>
          <Button size="sm" variant="ghost" onClick={resetAll}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset All
          </Button>
        </div>
      )}

      {unmarkedCount > 0 && students.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <span>Please mark attendance for all students before submitting. <strong>{unmarkedCount}</strong> remaining.</span>
        </div>
      )}

      <Card className="glass">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {students.map((s, i) => {
              const status = attendance.get(s.id);
              const unmarked = !status;
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 sm:p-4 transition-colors animate-fade-in',
                    unmarked && 'bg-warning/5',
                    status === 'present' && 'bg-success/5',
                    status === 'absent' && 'bg-destructive/5',
                  )}
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground w-6 shrink-0">{s.symbol_number}</span>
                    <span className="font-medium text-sm truncate">{s.name}</span>
                    {unmarked && (
                      <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Unmarked</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant={status === 'present' ? 'default' : 'outline'}
                      className={cn(status === 'present' && 'bg-success hover:bg-success/90 text-success-foreground border-success')}
                      onClick={() => setStatus(s.id, 'present')}
                    >
                      <Check className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Present</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={status === 'absent' ? 'default' : 'outline'}
                      className={cn(status === 'absent' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive')}
                      onClick={() => setStatus(s.id, 'absent')}
                    >
                      <X className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Absent</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {students.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Select a class and section to start</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ParentAttendanceView() {
  const { selectedChild } = useChildContext();
  const [records, setRecords] = useState<{ status: Status; date: string }[]>([]);

  useEffect(() => {
    if (!selectedChild) return;
    supabase.from('attendance')
      .select('status, date')
      .eq('student_id', selectedChild.id)
      .order('date', { ascending: false })
      .limit(60)
      .then(({ data }) => setRecords((data || []) as { status: Status; date: string }[]));
  }, [selectedChild]);

  if (!selectedChild) {
    return <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">No child selected</CardContent></Card>;
  }

  const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const rate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance History</h1>
        <p className="text-muted-foreground">{selectedChild.name} · {selectedChild.class_name} {selectedChild.section_name}</p>
      </div>

      <div className="flex gap-4">
        <Badge variant="secondary" className="text-sm px-4 py-2">Total: {records.length} days</Badge>
        <Badge variant="secondary" className="text-sm px-4 py-2">Present: {presentCount}</Badge>
        <Badge variant="secondary" className="text-sm px-4 py-2">Rate: {rate}%</Badge>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {records.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{format(new Date(r.date), 'EEEE, MMM d, yyyy')}</span>
                <Badge className={cn('capitalize text-xs', statusColors[r.status])}>
                  {r.status}
                </Badge>
              </div>
            ))}
            {records.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No attendance records found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
