import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Student { id: string; name: string; symbol_number: string }
interface Subject { id: string; name: string }
interface Assignment { id: string; student_id: string; subject_id: string; title: string; completed: boolean; assigned_date: string }

export default function Assignments() {
  const { role } = useAuth();

  if (role === 'parent') {
    return <ParentAssignmentsView />;
  }

  return <TeacherAdminAssignments />;
}

function TeacherAdminAssignments() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

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

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    supabase.from('students').select('id, name, symbol_number')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .order('symbol_number')
      .then(async ({ data: studs }) => {
        setStudents(studs || []);
        if (studs && studs.length > 0) {
          const { data } = await supabase.from('assignments')
            .select('id, student_id, subject_id, title, completed, assigned_date')
            .in('student_id', studs.map(s => s.id));
          setAssignments((data || []) as Assignment[]);
        }
      });
  }, [selectedClass, selectedSection]);

  const toggleAssignment = async (assignmentId: string, current: boolean) => {
    const { error } = await supabase.from('assignments')
      .update({ completed: !current }).eq('id', assignmentId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, completed: !current } : a));
    }
  };

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const assignmentTitles = [...new Set(assignments.map(a => a.title))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignment Tracker</h1>
        <p className="text-muted-foreground">Click to toggle completion status</p>
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
      </div>

      {students.length > 0 && assignments.length > 0 ? (
        <Card className="glass overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/5 border-b">
                  <th className="sticky left-0 z-10 bg-primary/5 px-3 py-3 text-left font-medium">Student</th>
                  {assignmentTitles.map(t => (
                    <th key={t} className="px-3 py-3 text-center font-medium min-w-[100px]">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className={cn('border-b', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium">{s.name}</td>
                    {assignmentTitles.map(title => {
                      const a = assignments.find(x => x.student_id === s.id && x.title === title);
                      return (
                        <td key={title} className="px-3 py-2 text-center">
                          {a ? (
                            <button onClick={() => toggleAssignment(a.id, a.completed ?? false)}>
                              <Badge variant={a.completed ? 'default' : 'destructive'} className="cursor-pointer text-xs">
                                {a.completed ? '✓' : '✗'}
                              </Badge>
                            </button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            {students.length === 0 ? 'Select a class and section' : 'No assignments found for this class'}
          </CardContent>
        </Card>
      )}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="text-muted-foreground">{selectedChild.name} · {completed}/{assignments.length} completed</p>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {subjects.find(s => s.id === a.subject_id)?.name || ''}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">{a.assigned_date}</span>
                </div>
                <Badge variant={a.completed ? 'default' : 'destructive'} className="text-xs">
                  {a.completed ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No assignments found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
