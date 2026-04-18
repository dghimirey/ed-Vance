import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { calculateSubjectGP, calculateFinalGPA, getGradeFromPercentage } from '@/lib/grading';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface Mark { subject_id: string; theory_marks: number; internal_marks: number }
interface Subject { id: string; name: string; credit_hours: number; th_full_marks: number; in_full_marks: number }

export default function ReportCard() {
  const { role } = useAuth();
  const { selectedChild } = useChildContext();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const childId = role === 'parent' ? selectedChild?.id : null;

  const handleExportPDF = async () => {
    if (!reportRef.current || !selectedChild) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }
      const safeName = selectedChild.name.replace(/\s+/g, '_');
      pdf.save(`ReportCard_${safeName}.pdf`);
      toast.success('Report card downloaded');
    } catch (e) {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    supabase.from('subjects').select('*').order('name').then(({ data }) => {
      if (data) setSubjects(data as Subject[]);
    });
  }, []);

  useEffect(() => {
    if (!childId) return;
    supabase.from('marks').select('subject_id, theory_marks, internal_marks')
      .eq('student_id', childId)
      .then(({ data }) => setMarks((data || []) as Mark[]));
  }, [childId]);

  if (!selectedChild) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center text-muted-foreground">
          No child selected
        </CardContent>
      </Card>
    );
  }

  const subjectResults = subjects.map(s => {
    const m = marks.find(mk => mk.subject_id === s.id);
    return calculateSubjectGP(
      m?.theory_marks ?? 0, s.th_full_marks,
      m?.internal_marks ?? 0, s.in_full_marks,
      s.credit_hours
    );
  }).map((r, i) => ({ ...r, subject: subjects[i] }));

  const finalGPA = calculateFinalGPA(
    subjectResults.map(r => ({ gp: r.gp, isNG: r.isNG, creditHours: r.subject.credit_hours }))
  );

  const radarData = subjectResults.map(r => ({
    subject: r.subject.name.substring(0, 6),
    percentage: Math.round(r.percentage),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Card</h1>
          <p className="text-muted-foreground">
            {selectedChild.name} · {selectedChild.class_name} {selectedChild.section_name}
          </p>
        </div>
        <Button onClick={handleExportPDF} disabled={exporting} className="gap-2">
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </Button>
      </div>
      <div ref={reportRef} className="space-y-6 bg-background p-2 rounded-lg">

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Final GPA</p>
            <p className="text-4xl font-bold">
              {finalGPA.hasNG ? <span className="text-destructive">NG</span> : finalGPA.gpa?.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Overall Grade</p>
            <p className="text-4xl font-bold">
              {finalGPA.hasNG ? (
                <span className="text-destructive">NG</span>
              ) : (
                getGradeFromPercentage(
                  subjectResults.reduce((s, r) => s + r.totalMarks, 0) /
                  subjects.reduce((s, sub) => s + sub.th_full_marks + sub.in_full_marks, 0) * 100
                ).letter
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Marks</p>
            <p className="text-4xl font-bold">
              {subjectResults.reduce((s, r) => s + r.totalMarks, 0)}
              <span className="text-lg text-muted-foreground">
                /{subjects.reduce((s, sub) => s + sub.th_full_marks + sub.in_full_marks, 0)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Performance Radar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="%" dataKey="percentage" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Subject Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subjectResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{r.subject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      TH: {marks.find(m => m.subject_id === r.subject.id)?.theory_marks ?? 0}/{r.subject.th_full_marks} |
                      IN: {marks.find(m => m.subject_id === r.subject.id)?.internal_marks ?? 0}/{r.subject.in_full_marks}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.percentage.toFixed(0)}%</span>
                    <Badge variant={r.isNG ? 'destructive' : 'secondary'} className="text-xs">
                      {r.grade.letter}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
