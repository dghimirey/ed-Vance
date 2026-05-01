import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { CheckCheck, X as XIcon, BookOpen } from 'lucide-react';

interface Student { id: string; name: string; symbol_number: string }
interface Subject { id: string; name: string }
interface Assignment { id: string; student_id: string; subject_id: string; title: string; completed: boolean; assigned_date: string }

export default function Assignments() {
  const { role } = useAuth();
  if (role === 'parent') return <ParentAssignmentsView />;
  return <TeacherAdminAssignments />;
}

function TeacherAdminAssignments() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  // map student_id -> { id?: string, completed: boolean }
  const [completion, setCompletion] = useState<Map<string, { id?: string; completed: boolean }>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('subjects').select('id, name').order('name'),
    ]).then(([c, s, sub]) => {
      if (c.data) setClasses(c.data);
      if (s.data) setSections(s.data);
      if (sub.data) setSubjects(sub.data);
    });
  }, []);

  const monthTitle = `Monthly Assignments — ${month}`;
  const monthStart = format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');

  useEffect(() => {
    if (!selectedClass || !selectedSection) { setStudents([]); return; }
    supabase.from('students').select('id, name, symbol_number')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .order('symbol_number')
      .then(({ data }) => setStudents(data || []));
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    if (!selectedSubject || students.length === 0) { setCompletion(new Map()); return; }
    supabase.from('assignments')
      .select('id, student_id, subject_id, title, completed, assigned_date')
      .eq('subject_id', selectedSubject)
      .eq('title', monthTitle)
      .gte('assigned_date', monthStart).lte('assigned_date', monthEnd)
      .in('student_id', students.map(s => s.id))
      .then(({ data }) => {
        const map = new Map<string, { id?: string; completed: boolean }>();
        students.forEach(s => map.set(s.id, { completed: false }));
        (data || []).forEach((a: Assignment) => {
          map.set(a.student_id, { id: a.id, completed: a.completed });
        });
        setCompletion(map);
      });
  }, [selectedSubject, students, month]);

  const toggle = (studentId: string, value: boolean) => {
    const next = new Map(completion);
    const cur = next.get(studentId) || { completed: false };
    next.set(studentId, { ...cur, completed: value });
    setCompletion(next);
  };

  const selectAll = (value: boolean) => {
    const next = new Map(completion);
    students.forEach(s => {
      const cur = next.get(s.id) || { completed: false };
      next.set(s.id, { ...cur, completed: value });
    });
    setCompletion(next);
  };

  const save = async () => {
    if (!selectedSubject) {
      toast.warning('Please select a subject', { description: 'Choose class, section, and subject before saving.' });
      return;
    }
    if (students.length === 0) {
      toast.warning('No students found', { description: 'This class and section has no enrolled students.' });
      return;
    }
    setSaving(true);

    const subj = subjects.find(s => s.id === selectedSubject)!;
    const records = students.map(s => {
      const c = completion.get(s.id) || { completed: false };
      return {
        ...(c.id ? { id: c.id } : {}),
        student_id: s.id,
        subject_id: selectedSubject,
        title: monthTitle,
        completed: c.completed,
        assigned_date: monthStart,
      };
    });

    // Split insert vs update for clarity
    const toUpdate = records.filter(r => 'id' in r);
    const toInsert = records.filter(r => !('id' in r));

    let failed = 0;
    let lastError: string | null = null;

    if (toInsert.length > 0) {
      const { error } = await supabase.from('assignments').insert(toInsert);
      if (error) { failed += toInsert.length; lastError = error.message; }
    }
    for (const u of toUpdate) {
      const { error } = await supabase.from('assignments').update({ completed: u.completed }).eq('id', (u as any).id);
      if (error) { failed += 1; lastError = error.message; }
    }
    setSaving(false);

    if (failed > 0) {
      toast.error('Some assignment statuses could not be saved', {
        description: `${failed} of ${records.length} failed. ${lastError ? 'Reason: ' + lastError : ''}`,
      });
    } else {
      toast.success('Assignment statuses saved', {
        description: `${subj.name} · ${month} · ${records.length} student${records.length === 1 ? '' : 's'} updated.`,
      });
    }
  };

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const completedCount = students.filter(s => completion.get(s.id)?.completed).length;
  const pct = students.length > 0 ? Math.round((completedCount / students.length) * 100) : 0;

  // Last 6 months selector
  const monthOptions = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(format(d, 'yyyy-MM'));
    }
    return out;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignment Tracker</h1>
          <p className="text-muted-foreground">Tick to mark a student's monthly assignment as completed.</p>
        </div>
        <Button onClick={save} disabled={saving || !selectedSubject || students.length === 0}>
          {saving ? 'Saving...' : 'Save'}
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
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {students.length > 0 && selectedSubject && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => selectAll(true)}>
              <CheckCheck className="w-4 h-4 mr-1" /> Select All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
              <XIcon className="w-4 h-4 mr-1" /> Clear All
            </Button>
            <Badge variant="secondary" className="ml-auto">
              {completedCount}/{students.length} completed · {pct}%
            </Badge>
          </div>
          <Progress value={pct} className="h-2" />
        </>
      )}

      <Card className="glass">
        <CardContent className="p-0">
          {!selectedSubject || students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {students.length === 0 ? 'Select a class and section to load students.' : 'Pick a subject to start tracking.'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {students.map((s, i) => {
                const c = completion.get(s.id);
                const checked = !!c?.completed;
                return (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between gap-3 p-3 sm:p-4 cursor-pointer transition-colors animate-fade-in ${
                      checked ? 'bg-success/5' : 'hover:bg-accent/30'
                    }`}
                    style={{ animationDelay: `${i * 15}ms` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox checked={checked} onCheckedChange={(v) => toggle(s.id, !!v)} />
                      <span className="text-xs text-muted-foreground w-6 shrink-0">{s.symbol_number}</span>
                      <span className="font-medium text-sm truncate">{s.name}</span>
                    </div>
                    <Badge variant={checked ? 'default' : 'secondary'} className={`text-xs ${checked ? 'bg-success text-success-foreground' : ''}`}>
                      {checked ? 'Completed' : 'Not Completed'}
                    </Badge>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ParentAssignmentsView() {
  const { selectedChild } = useChildContext();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!selectedChild) return;
    Promise.all([
      supabase.from('assignments')
        .select('id, student_id, subject_id, title, completed, assigned_date')
        .eq('student_id', selectedChild.id)
        .order('assigned_date', { ascending: false }),
      supabase.from('subjects').select('id, name').order('name'),
    ]).then(([assRes, subRes]) => {
      setAssignments((assRes.data || []) as Assignment[]);
      setSubjects(subRes.data || []);
    });
  }, [selectedChild]);

  if (!selectedChild) {
    return <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">No child selected</CardContent></Card>;
  }

  const completed = assignments.filter(a => a.completed).length;
  const pct = assignments.length > 0 ? Math.round((completed / assignments.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="text-muted-foreground">{selectedChild.name} · {completed}/{assignments.length} completed ({pct}%)</p>
      </div>

      <Progress value={pct} className="h-2" />

      <Card className="glass">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium block truncate">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {subjects.find(s => s.id === a.subject_id)?.name || ''} · {a.assigned_date}
                    </span>
                  </div>
                </div>
                <Badge variant={a.completed ? 'default' : 'secondary'} className={`text-xs shrink-0 ${a.completed ? 'bg-success text-success-foreground' : ''}`}>
                  {a.completed ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No assignments tracked yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
