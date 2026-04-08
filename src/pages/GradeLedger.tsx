import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { calculateSubjectGP, calculateFinalGPA, rankStudents, getGradeFromPercentage } from '@/lib/grading';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface Subject { id: string; name: string; code: string; credit_hours: number; th_full_marks: number; in_full_marks: number }
interface Student { id: string; name: string; symbol_number: string }
interface Mark { student_id: string; subject_id: string; theory_marks: number | null; internal_marks: number | null }

export default function GradeLedger() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('subjects').select('*').order('name'),
    ]).then(([c, s, sub]) => {
      if (c.data) setClasses(c.data);
      if (s.data) setSections(s.data);
      if (sub.data) setSubjects(sub.data as Subject[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    setLoading(true);
    supabase.from('students').select('id, name, symbol_number')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .order('symbol_number')
      .then(async ({ data: studs }) => {
        const studentList = studs || [];
        setStudents(studentList);
        if (studentList.length > 0) {
          const { data: marksData } = await supabase.from('marks')
            .select('student_id, subject_id, theory_marks, internal_marks')
            .in('student_id', studentList.map(s => s.id));
          setMarks((marksData || []) as Mark[]);
        } else {
          setMarks([]);
        }
        setLoading(false);
      });
  }, [selectedClass, selectedSection]);

  const filteredSections = sections.filter(s => s.class_id === selectedClass);

  const ledgerData = useMemo(() => {
    return students.map(student => {
      const subjectResults = subjects.map(subject => {
        const mark = marks.find(m => m.student_id === student.id && m.subject_id === subject.id);
        const th = mark?.theory_marks ?? 0;
        const inn = mark?.internal_marks ?? 0;
        const result = calculateSubjectGP(th, subject.th_full_marks, inn, subject.in_full_marks, subject.credit_hours);
        return { ...result, subject, th, inn };
      });

      const totalMarks = subjectResults.reduce((sum, r) => sum + r.totalMarks, 0);
      const totalFullMarks = subjects.reduce((sum, s) => sum + s.th_full_marks + s.in_full_marks, 0);
      const totalPercentage = totalFullMarks > 0 ? (totalMarks / totalFullMarks) * 100 : 0;
      const finalGPA = calculateFinalGPA(
        subjectResults.map(r => ({ gp: r.gp, isNG: r.isNG, creditHours: r.subject.credit_hours }))
      );

      return {
        student,
        subjectResults,
        totalMarks,
        totalPercentage,
        finalGPA: finalGPA.gpa,
        hasNG: finalGPA.hasNG,
        overallGrade: finalGPA.hasNG ? { letter: 'NG', description: 'Non-Graded' } : getGradeFromPercentage(totalPercentage),
      };
    });
  }, [students, subjects, marks]);

  const rankings = useMemo(() => {
    return rankStudents(ledgerData.map(d => ({
      id: d.student.id, totalMarks: d.totalMarks, hasNG: d.hasNG, symbolNumber: d.student.symbol_number,
    })));
  }, [ledgerData]);

  const exportExcel = () => {
    const header1 = ['S.No', 'Name', 'Symbol No.'];
    subjects.forEach(s => { header1.push(s.name, '', ''); });
    header1.push('Total', 'Percentage', 'GPA', 'Grade', 'Rank');
    const header2 = ['', '', ''];
    subjects.forEach(() => { header2.push('TH', 'IN', 'Total'); });
    header2.push('', '', '', '', '');
    const rows = ledgerData.map((d, i) => {
      const row: (string | number)[] = [i + 1, d.student.name, d.student.symbol_number];
      d.subjectResults.forEach(r => { row.push(r.th, r.inn, r.totalMarks); });
      row.push(d.totalMarks, `${d.totalPercentage.toFixed(1)}%`,
        d.finalGPA !== null ? d.finalGPA.toFixed(2) : 'NG',
        d.overallGrade.letter, rankings.get(d.student.id) ?? 'NG');
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grade Ledger');
    XLSX.writeFile(wb, 'grade_ledger.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grade Ledger</h1>
          <p className="text-muted-foreground">Nepalese Grading Directive 2078 — Full marks breakdown</p>
        </div>
        <Button onClick={exportExcel} variant="outline" disabled={ledgerData.length === 0}>
          <Download className="w-4 h-4 mr-1" /> Export Excel
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection(''); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Section" /></SelectTrigger>
          <SelectContent>{filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/5 border-b">
                  <th className="sticky left-0 z-20 bg-primary/5 px-3 py-3 text-left font-medium min-w-[50px]">S.No</th>
                  <th className="sticky left-[50px] z-20 bg-primary/5 px-3 py-3 text-left font-medium min-w-[150px]">Name</th>
                  <th className="sticky left-[200px] z-20 bg-primary/5 px-3 py-3 text-left font-medium min-w-[100px]">Sym. No.</th>
                  {subjects.map(s => (
                    <th key={s.id} colSpan={3} className="px-3 py-3 text-center font-medium border-l border-border/50">{s.name}</th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium border-l border-border/50">Total</th>
                  <th className="px-3 py-3 text-center font-medium">%</th>
                  <th className="px-3 py-3 text-center font-medium">GPA</th>
                  <th className="px-3 py-3 text-center font-medium">Grade</th>
                  <th className="px-3 py-3 text-center font-medium">Rank</th>
                </tr>
                <tr className="bg-muted/30 border-b">
                  <th className="sticky left-0 z-20 bg-muted/30" />
                  <th className="sticky left-[50px] z-20 bg-muted/30" />
                  <th className="sticky left-[200px] z-20 bg-muted/30" />
                  {subjects.map(s => (
                    <React.Fragment key={`sub-${s.id}`}>
                      <th className="px-2 py-2 text-center text-xs text-muted-foreground border-l border-border/50">TH</th>
                      <th className="px-2 py-2 text-center text-xs text-muted-foreground">IN</th>
                      <th className="px-2 py-2 text-center text-xs text-muted-foreground">Tot</th>
                    </React.Fragment>
                  ))}
                  <th /><th /><th /><th /><th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={100} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                ) : ledgerData.length === 0 ? (
                  <tr><td colSpan={100} className="text-center py-8 text-muted-foreground">Select a class and section to view the ledger</td></tr>
                ) : ledgerData.map((d, i) => {
                  const rank = rankings.get(d.student.id);
                  return (
                    <tr key={d.student.id} className={cn('border-b hover:bg-accent/30 transition-colors', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                      <td className="sticky left-0 z-10 px-3 py-2 text-muted-foreground bg-inherit">{i + 1}</td>
                      <td className="sticky left-[50px] z-10 px-3 py-2 font-medium bg-inherit">{d.student.name}</td>
                      <td className="sticky left-[200px] z-10 px-3 py-2 bg-inherit">
                        <Badge variant="secondary" className="text-xs">{d.student.symbol_number}</Badge>
                      </td>
                      {d.subjectResults.map((r, j) => (
                        <React.Fragment key={j}>
                          <td className={cn('px-2 py-2 text-center border-l border-border/50', r.isNG && 'text-destructive font-medium')}>{r.th}</td>
                          <td className={cn('px-2 py-2 text-center', r.isNG && 'text-destructive font-medium')}>{r.inn}</td>
                          <td className={cn('px-2 py-2 text-center font-medium', r.isNG && 'text-destructive')}>
                            {r.totalMarks}{r.isNG && <span className="text-[10px] ml-0.5">NG</span>}
                          </td>
                        </React.Fragment>
                      ))}
                      <td className="px-3 py-2 text-center font-bold border-l border-border/50">{d.totalMarks}</td>
                      <td className="px-3 py-2 text-center">{d.totalPercentage.toFixed(1)}%</td>
                      <td className={cn('px-3 py-2 text-center font-medium', d.hasNG && 'text-destructive')}>
                        {d.finalGPA !== null ? d.finalGPA.toFixed(2) : 'NG'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={d.hasNG ? 'destructive' : 'secondary'} className="text-xs">{d.overallGrade.letter}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-medium">
                        {rank !== null ? rank : <span className="text-destructive">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
