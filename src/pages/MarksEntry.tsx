import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkNG } from '@/lib/grading';

interface Subject { id: string; name: string; th_full_marks: number; in_full_marks: number }
interface Student { id: string; name: string; symbol_number: string }
interface MarkEntry { student_id: string; subject_id: string; theory_marks: number; internal_marks: number }

export default function MarksEntry() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [term, setTerm] = useState('First Term');
  const [marks, setMarks] = useState<Map<string, { th: number; inn: number }>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('subjects').select('id, name, th_full_marks, in_full_marks').order('name'),
    ]).then(([c, s, sub]) => {
      if (c.data) setClasses(c.data);
      if (s.data) setSections(s.data);
      if (sub.data) setSubjects(sub.data as Subject[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    supabase.from('students').select('id, name, symbol_number')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .order('symbol_number')
      .then(({ data }) => setStudents(data || []));
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    if (!selectedSubject || students.length === 0) return;
    supabase.from('marks').select('student_id, theory_marks, internal_marks')
      .eq('subject_id', selectedSubject).eq('term', term)
      .in('student_id', students.map(s => s.id))
      .then(({ data }) => {
        const map = new Map<string, { th: number; inn: number }>();
        (data || []).forEach((m: any) => map.set(m.student_id, {
          th: m.theory_marks ?? 0, inn: m.internal_marks ?? 0,
        }));
        setMarks(map);
      });
  }, [selectedSubject, students, term]);

  const updateMark = (studentId: string, field: 'th' | 'inn', value: number) => {
    const current = marks.get(studentId) || { th: 0, inn: 0 };
    setMarks(new Map(marks).set(studentId, { ...current, [field]: value }));
  };

  const saveMarks = async () => {
    if (!selectedSubject) return;
    setSaving(true);
    const subject = subjects.find(s => s.id === selectedSubject)!;
    const records = students.map(s => {
      const m = marks.get(s.id) || { th: 0, inn: 0 };
      return {
        student_id: s.id, subject_id: selectedSubject, term,
        theory_marks: m.th, internal_marks: m.inn,
        is_ng: checkNG(m.th, subject.th_full_marks, m.inn, subject.in_full_marks),
        recorded_by: user?.id,
      };
    });
    const { error } = await supabase.from('marks').upsert(records, { onConflict: 'student_id,subject_id,term' });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Marks saved' });
    setSaving(false);
  };

  const downloadTemplate = () => {
    const rows = students.map(s => ({
      'Symbol Number': s.symbol_number, 'Name': s.name,
      'Theory Marks (TH)': '', 'Internal Marks (IN)': '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks Template');
    XLSX.writeFile(wb, `marks_template_${term}.xlsx`);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets[wb.SheetNames[0]]);

    const newMarks = new Map(marks);
    rows.forEach(row => {
      const sym = String(row['Symbol Number'] || '');
      const student = students.find(s => s.symbol_number === sym);
      if (student) {
        newMarks.set(student.id, {
          th: Number(row['Theory Marks (TH)'] || 0),
          inn: Number(row['Internal Marks (IN)'] || 0),
        });
      }
    });
    setMarks(newMarks);
    toast({ title: 'Marks loaded from file — click Save to commit' });
    e.target.value = '';
  };

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const currentSubject = subjects.find(s => s.id === selectedSubject);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marks Entry</h1>
          <p className="text-muted-foreground">Enter Theory (TH) and Internal (IN) marks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate} disabled={students.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Template
          </Button>
          <div className="relative">
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            <Button variant="outline"><Upload className="w-4 h-4 mr-1" /> Upload</Button>
          </div>
          <Button onClick={saveMarks} disabled={saving || !selectedSubject}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
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
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="First Term">First Term</SelectItem>
            <SelectItem value="Second Term">Second Term</SelectItem>
            <SelectItem value="Third Term">Third Term</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass">
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol No.</TableHead>
                <TableHead className="text-center">TH ({currentSubject?.th_full_marks ?? 75})</TableHead>
                <TableHead className="text-center">IN ({currentSubject?.in_full_marks ?? 25})</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Select class, section, and subject
                </TableCell></TableRow>
              ) : students.map((s, i) => {
                const m = marks.get(s.id) || { th: 0, inn: 0 };
                const total = m.th + m.inn;
                const isNG = currentSubject ? checkNG(m.th, currentSubject.th_full_marks, m.inn, currentSubject.in_full_marks) : false;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary">{s.symbol_number}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number" min={0} max={currentSubject?.th_full_marks ?? 75}
                        value={m.th} onChange={e => updateMark(s.id, 'th', Number(e.target.value))}
                        className="w-20 mx-auto text-center h-9"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number" min={0} max={currentSubject?.in_full_marks ?? 25}
                        value={m.inn} onChange={e => updateMark(s.id, 'inn', Number(e.target.value))}
                        className="w-20 mx-auto text-center h-9"
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium">{total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isNG ? 'destructive' : 'secondary'}>
                        {isNG ? 'NG' : 'Pass'}
                      </Badge>
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
