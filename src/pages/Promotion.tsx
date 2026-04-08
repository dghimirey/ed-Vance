import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { checkNG } from '@/lib/grading';
import { Award, ArrowUpCircle } from 'lucide-react';

interface Student {
  id: string; name: string; symbol_number: string;
  class_id: string; section_id: string;
}
interface Subject { id: string; th_full_marks: number; in_full_marks: number }

export default function Promotion() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string; numeric_level: number }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [results, setResults] = useState<Map<string, boolean>>(new Map());
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, name, numeric_level').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('subjects').select('id, th_full_marks, in_full_marks'),
    ]).then(([c, s, sub]) => {
      if (c.data) setClasses(c.data);
      if (s.data) setSections(s.data);
      if (sub.data) setSubjects(sub.data as Subject[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    supabase.from('students').select('id, name, symbol_number, class_id, section_id')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .order('symbol_number')
      .then(async ({ data: studs }) => {
        setStudents(studs || []);
        if (!studs || studs.length === 0) return;

        const { data: marks } = await supabase.from('marks')
          .select('student_id, subject_id, theory_marks, internal_marks')
          .in('student_id', studs.map(s => s.id));

        const resultMap = new Map<string, boolean>();
        studs.forEach(s => {
          const studentMarks = (marks || []).filter(m => m.student_id === s.id);
          const hasNG = studentMarks.some(m => {
            const sub = subjects.find(su => su.id === m.subject_id);
            if (!sub) return false;
            return checkNG(m.theory_marks || 0, sub.th_full_marks, m.internal_marks || 0, sub.in_full_marks);
          });
          resultMap.set(s.id, !hasNG && studentMarks.length > 0);
        });
        setResults(resultMap);
      });
  }, [selectedClass, selectedSection, subjects]);

  const promoteAll = async () => {
    setPromoting(true);
    const currentClassLevel = classes.find(c => c.id === selectedClass)?.numeric_level;
    if (currentClassLevel === undefined) { setPromoting(false); return; }

    const nextClass = classes.find(c => c.numeric_level === currentClassLevel + 1);
    if (!nextClass) {
      toast({ title: 'No next class available', variant: 'destructive' });
      setPromoting(false);
      return;
    }

    const nextSection = sections.find(s => s.class_id === nextClass.id);
    if (!nextSection) {
      toast({ title: 'No section found in next class', variant: 'destructive' });
      setPromoting(false);
      return;
    }

    const eligible = students.filter(s => results.get(s.id) === true);
    for (const s of eligible) {
      await supabase.from('students').update({
        class_id: nextClass.id, section_id: nextSection.id,
      }).eq('id', s.id);
    }

    toast({ title: `${eligible.length} students promoted to ${nextClass.name}` });
    setPromoting(false);
    setResults(new Map());
    setStudents([]);
  };

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const eligible = students.filter(s => results.get(s.id) === true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Promotion</h1>
          <p className="text-muted-foreground">Promote eligible students to next class</p>
        </div>
        <Button onClick={promoteAll} disabled={promoting || eligible.length === 0}>
          <ArrowUpCircle className="w-4 h-4 mr-1" />
          {promoting ? 'Promoting...' : `Promote All (${eligible.length})`}
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection(''); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol No.</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Select class and section
                </TableCell></TableRow>
              ) : students.map((s, i) => {
                const pass = results.get(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary">{s.symbol_number}</Badge></TableCell>
                    <TableCell className="text-center">
                      {pass === undefined ? (
                        <Badge variant="secondary">No marks</Badge>
                      ) : pass ? (
                        <Badge className="bg-success text-success-foreground">
                          <Award className="w-3 h-3 mr-1" /> Eligible
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Not Eligible (NG)</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
