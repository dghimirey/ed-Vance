import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Status = 'present' | 'absent' | 'late' | 'leave';
interface Student { id: string; name: string; symbol_number: string }
interface AttendanceRecord { student_id: string; status: Status }

const statusColors: Record<Status, string> = {
  present: 'bg-success text-success-foreground',
  absent: 'bg-destructive text-destructive-foreground',
  late: 'bg-warning text-warning-foreground',
  leave: 'bg-muted text-muted-foreground',
};

export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<Map<string, Status>>(new Map());
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
        // Load existing attendance
        if (data && data.length > 0) {
          supabase.from('attendance')
            .select('student_id, status')
            .in('student_id', data.map(s => s.id))
            .eq('date', selectedDate)
            .then(({ data: attData }) => {
              const map = new Map<string, Status>();
              (attData || []).forEach((a: AttendanceRecord) => map.set(a.student_id, a.status));
              setAttendance(map);
            });
        }
      });
  }, [selectedClass, selectedSection, selectedDate]);

  const toggleStatus = (studentId: string) => {
    const order: Status[] = ['present', 'absent', 'late', 'leave'];
    const current = attendance.get(studentId) || 'present';
    const next = order[(order.indexOf(current) + 1) % order.length];
    setAttendance(new Map(attendance).set(studentId, next));
  };

  const saveAttendance = async () => {
    setSaving(true);
    const records = students.map(s => ({
      student_id: s.id,
      date: selectedDate,
      status: attendance.get(s.id) || 'present' as Status,
      recorded_by: user?.id,
    }));

    const { error } = await supabase.from('attendance')
      .upsert(records, { onConflict: 'student_id,date' });

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Attendance saved' });
    }
    setSaving(false);
  };

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const presentCount = [...attendance.values()].filter(s => s === 'present').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Click status to cycle: Present → Absent → Late → Leave</p>
        </div>
        <Button onClick={saveAttendance} disabled={saving || students.length === 0}>
          {saving ? 'Saving...' : 'Save Attendance'}
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
          <Badge variant="secondary" className="h-10 flex items-center">
            Present: {presentCount}/{students.length}
          </Badge>
        )}
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-border">
            {students.map((s, i) => {
              const status = attendance.get(s.id) || 'present';
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStatus(s.id)}
                  className={cn(
                    'flex items-center justify-between p-4 bg-background hover:bg-accent/30 transition-all cursor-pointer animate-fade-in',
                  )}
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{s.symbol_number}</span>
                    <span className="font-medium text-sm">{s.name}</span>
                  </div>
                  <Badge className={cn('capitalize text-xs', statusColors[status])}>
                    {status}
                  </Badge>
                </button>
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
