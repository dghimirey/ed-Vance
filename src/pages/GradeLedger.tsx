import { useEffect, useState, useMemo, useRef } from 'react';
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
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 4);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [students.length]);

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

  // Frozen column widths (keep in sync between header & body)
  const W_SNO = 56;
  const W_NAME = 180;
  const W_SYM = 120;

  // SOLID backgrounds for sticky cells — no transparency, no blur.
  // Z-index hierarchy: top-left corner (40) > sticky header row (30)
  // > sticky first columns in body (20) > scrollable body (1).
  const stickyHeaderCell = 'sticky bg-secondary z-30';
  const stickyCornerCell = 'sticky bg-secondary z-40';

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
        <CardContent className="p-0 relative">
          {/* Right-edge fade affordance for horizontal scroll */}
          <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-card/90 to-transparent z-40" />

          <div ref={scrollRef} className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th
                    style={{ left: 0, width: W_SNO, minWidth: W_SNO }}
                    className={cn(stickyHeader, 'px-3 py-3 text-left font-medium border-b border-border')}
                  >S.No</th>
                  <th
                    style={{ left: W_SNO, width: W_NAME, minWidth: W_NAME }}
                    className={cn(stickyHeader, 'px-3 py-3 text-left font-medium border-b border-border')}
                  >Name</th>
                  <th
                    style={{ left: W_SNO + W_NAME, width: W_SYM, minWidth: W_SYM }}
                    className={cn(
                      stickyHeader,
                      'px-3 py-3 text-left font-medium border-b border-border',
                      scrolled && 'sticky-shadow-right'
                    )}
                  >Sym. No.</th>
                  {subjects.map(s => (
                    <th
                      key={s.id}
                      colSpan={3}
                      className="px-3 py-3 text-center font-medium border-b border-l border-border bg-primary/10"
                      style={{ minWidth: 180 }}
                    >{s.name}</th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium border-b border-l border-border bg-primary/10" style={{ minWidth: 80 }}>Total</th>
                  <th className="px-3 py-3 text-center font-medium border-b border-border bg-primary/10" style={{ minWidth: 70 }}>%</th>
                  <th className="px-3 py-3 text-center font-medium border-b border-border bg-primary/10" style={{ minWidth: 70 }}>GPA</th>
                  <th className="px-3 py-3 text-center font-medium border-b border-border bg-primary/10" style={{ minWidth: 80 }}>Grade</th>
                  <th className="px-3 py-3 text-center font-medium border-b border-border bg-primary/10" style={{ minWidth: 70 }}>Rank</th>
                </tr>
                <tr>
                  <th style={{ left: 0, width: W_SNO, minWidth: W_SNO }} className={cn(stickyHeader, 'border-b border-border')} />
                  <th style={{ left: W_SNO, width: W_NAME, minWidth: W_NAME }} className={cn(stickyHeader, 'border-b border-border')} />
                  <th
                    style={{ left: W_SNO + W_NAME, width: W_SYM, minWidth: W_SYM }}
                    className={cn(stickyHeader, 'border-b border-border', scrolled && 'sticky-shadow-right')}
                  />
                  {subjects.map(s => (
                    <React.Fragment key={`sub-${s.id}`}>
                      <th className="px-2 py-2 text-center text-xs text-muted-foreground border-b border-l border-border bg-muted/40" style={{ minWidth: 60 }}>TH</th>
                      <th className="px-2 py-2 text-center text-xs text-muted-foreground border-b border-border bg-muted/40" style={{ minWidth: 60 }}>IN</th>
                      <th className="px-2 py-2 text-center text-xs text-muted-foreground border-b border-border bg-muted/40" style={{ minWidth: 60 }}>Tot</th>
                    </React.Fragment>
                  ))}
                  <th className="border-b border-border bg-muted/40" /><th className="border-b border-border bg-muted/40" />
                  <th className="border-b border-border bg-muted/40" /><th className="border-b border-border bg-muted/40" />
                  <th className="border-b border-border bg-muted/40" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={100} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                ) : ledgerData.length === 0 ? (
                  <tr><td colSpan={100} className="text-center py-8 text-muted-foreground">Select a class and section to view the ledger</td></tr>
                ) : ledgerData.map((d, i) => {
                  const rank = rankings.get(d.student.id);
                  const zebra = i % 2 === 0;
                  // Solid background per row (NOT inherit) so sticky cells don't bleed through
                  const rowBg = zebra ? 'bg-card' : 'bg-muted/30';
                  return (
                    <tr key={d.student.id} className="group">
                      <td
                        style={{ left: 0, width: W_SNO, minWidth: W_SNO }}
                        className={cn('sticky z-10 px-3 py-2 text-muted-foreground border-b border-border', rowBg, 'group-hover:bg-accent/50')}
                      >{i + 1}</td>
                      <td
                        style={{ left: W_SNO, width: W_NAME, minWidth: W_NAME }}
                        className={cn('sticky z-10 px-3 py-2 font-medium border-b border-border truncate', rowBg, 'group-hover:bg-accent/50')}
                      >{d.student.name}</td>
                      <td
                        style={{ left: W_SNO + W_NAME, width: W_SYM, minWidth: W_SYM }}
                        className={cn(
                          'sticky z-10 px-3 py-2 border-b border-border',
                          rowBg,
                          'group-hover:bg-accent/50',
                          scrolled && 'sticky-shadow-right'
                        )}
                      >
                        <Badge variant="secondary" className="text-xs">{d.student.symbol_number}</Badge>
                      </td>
                      {d.subjectResults.map((r, j) => (
                        <React.Fragment key={j}>
                          <td className={cn('px-2 py-2 text-center border-b border-l border-border', r.isNG && 'text-destructive font-medium')}>{r.th}</td>
                          <td className={cn('px-2 py-2 text-center border-b border-border', r.isNG && 'text-destructive font-medium')}>{r.inn}</td>
                          <td className={cn('px-2 py-2 text-center font-medium border-b border-border', r.isNG && 'text-destructive')}>
                            {r.totalMarks}{r.isNG && <span className="text-[10px] ml-0.5">NG</span>}
                          </td>
                        </React.Fragment>
                      ))}
                      <td className="px-3 py-2 text-center font-bold border-b border-l border-border">{d.totalMarks}</td>
                      <td className="px-3 py-2 text-center border-b border-border">{d.totalPercentage.toFixed(1)}%</td>
                      <td className={cn('px-3 py-2 text-center font-medium border-b border-border', d.hasNG && 'text-destructive')}>
                        {d.finalGPA !== null ? d.finalGPA.toFixed(2) : 'NG'}
                      </td>
                      <td className="px-3 py-2 text-center border-b border-border">
                        <Badge variant={d.hasNG ? 'destructive' : 'secondary'} className="text-xs">{d.overallGrade.letter}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-medium border-b border-border">
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
