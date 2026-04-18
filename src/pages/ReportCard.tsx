import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateSubjectGP, calculateFinalGPA, getGradeFromPercentage } from '@/lib/grading';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface Mark { subject_id: string; theory_marks: number; internal_marks: number }
interface Subject { id: string; name: string; code: string; credit_hours: number; th_full_marks: number; in_full_marks: number }
interface SchoolSettings { school_name: string; address: string | null; academic_year: string }

export default function ReportCard() {
  const { role } = useAuth();
  const { selectedChild } = useChildContext();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [school, setSchool] = useState<SchoolSettings | null>(null);
  const [exporting, setExporting] = useState(false);

  const childId = role === 'parent' ? selectedChild?.id : null;

  useEffect(() => {
    Promise.all([
      supabase.from('subjects').select('*').order('name'),
      supabase.from('school_settings').select('school_name, address, academic_year').limit(1).maybeSingle(),
    ]).then(([sRes, schRes]) => {
      if (sRes.data) setSubjects(sRes.data as Subject[]);
      if (schRes.data) setSchool(schRes.data as SchoolSettings);
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
        <CardContent className="py-12 text-center text-muted-foreground">No child selected</CardContent>
      </Card>
    );
  }

  const subjectResults = subjects.map(s => {
    const m = marks.find(mk => mk.subject_id === s.id);
    return { ...calculateSubjectGP(
      m?.theory_marks ?? 0, s.th_full_marks,
      m?.internal_marks ?? 0, s.in_full_marks,
      s.credit_hours
    ), subject: s, mark: m };
  });

  const finalGPA = calculateFinalGPA(
    subjectResults.map(r => ({ gp: r.gp, isNG: r.isNG, creditHours: r.subject.credit_hours }))
  );

  const totalMarks = subjectResults.reduce((s, r) => s + r.totalMarks, 0);
  const totalMax = subjects.reduce((s, sub) => s + sub.th_full_marks + sub.in_full_marks, 0);
  const overallPct = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
  const overallGrade = finalGPA.hasNG ? { letter: 'NG' } : getGradeFromPercentage(overallPct);

  const radarData = subjectResults.map(r => ({
    subject: r.subject.name.substring(0, 6),
    percentage: Math.round(r.percentage),
  }));

  const handleExportPDF = async () => {
    if (!selectedChild) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 14;
      const schoolName = school?.school_name || 'Digital School System';
      const academicYear = school?.academic_year || new Date().getFullYear().toString();
      const address = school?.address || '';

      // === HEADER ===
      // Logo placeholder circle (left)
      pdf.setFillColor(99, 102, 241);
      pdf.circle(margin + 8, 20, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(schoolName.charAt(0).toUpperCase(), margin + 8, 22.5, { align: 'center' });

      // School name + meta
      pdf.setTextColor(20, 20, 30);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(schoolName, pageW / 2, 17, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(110, 110, 120);
      if (address) pdf.text(address, pageW / 2, 23, { align: 'center' });
      pdf.text(`Academic Year: ${academicYear}`, pageW / 2, 28, { align: 'center' });

      // Divider
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.6);
      pdf.line(margin, 34, pageW - margin, 34);

      // Title
      pdf.setTextColor(20, 20, 30);
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('STUDENT REPORT CARD', pageW / 2, 41, { align: 'center' });

      // === STUDENT DETAILS ===
      const detailsY = 48;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(90, 90, 100);
      const labelGap = 4.5;
      const colW = (pageW - margin * 2) / 2;

      const drawDetail = (label: string, value: string, x: number, y: number) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 130);
        pdf.text(label, x, y);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(20, 20, 30);
        pdf.text(value, x + 30, y);
      };

      drawDetail('Student Name:', selectedChild.name, margin, detailsY);
      drawDetail('Symbol No.:', selectedChild.symbol_number, margin + colW, detailsY);
      drawDetail('Class:', selectedChild.class_name || '—', margin, detailsY + labelGap);
      drawDetail('Section:', selectedChild.section_name || '—', margin + colW, detailsY + labelGap);
      drawDetail('Issue Date:', format(new Date(), 'dd MMM yyyy'), margin, detailsY + labelGap * 2);
      drawDetail('Result:', finalGPA.hasNG ? 'NON-GRADED' : 'PASS', margin + colW, detailsY + labelGap * 2);

      // === MARKS TABLE ===
      const tableBody = subjectResults.map(r => [
        r.subject.name,
        `${r.mark?.theory_marks ?? 0}/${r.subject.th_full_marks}`,
        `${r.mark?.internal_marks ?? 0}/${r.subject.in_full_marks}`,
        `${r.totalMarks}/${r.subject.th_full_marks + r.subject.in_full_marks}`,
        `${r.percentage.toFixed(1)}%`,
        r.grade.letter,
        r.isNG ? '—' : r.gp.toFixed(2),
      ]);

      autoTable(pdf, {
        startY: detailsY + labelGap * 2 + 8,
        head: [['Subject', 'Theory', 'Internal', 'Total', '%', 'Grade', 'GP']],
        body: tableBody,
        styles: { fontSize: 9, cellPadding: 2.5, lineColor: [220, 220, 230], lineWidth: 0.2 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: [40, 40, 50] },
        columnStyles: {
          0: { halign: 'left', cellWidth: 'auto' },
          1: { halign: 'center' }, 2: { halign: 'center' },
          3: { halign: 'center' }, 4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' }, 6: { halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const idx = data.row.index;
            if (subjectResults[idx]?.isNG) {
              data.cell.styles.fillColor = [255, 244, 230];
              data.cell.styles.textColor = [180, 80, 30];
            }
          }
        },
        margin: { left: margin, right: margin },
      });

      // @ts-expect-error - autotable extends jsPDF
      const finalY: number = pdf.lastAutoTable.finalY + 8;

      // === SUMMARY ===
      pdf.setFillColor(245, 245, 250);
      pdf.roundedRect(margin, finalY, pageW - margin * 2, 22, 2, 2, 'F');
      pdf.setFontSize(9);
      pdf.setTextColor(110, 110, 120);
      pdf.setFont('helvetica', 'normal');

      const summary = [
        { label: 'Final GPA', value: finalGPA.hasNG ? 'NG' : finalGPA.gpa?.toFixed(2) || '—' },
        { label: 'Overall Grade', value: overallGrade.letter },
        { label: 'Total Marks', value: `${totalMarks}/${totalMax}` },
        { label: 'Percentage', value: `${overallPct.toFixed(1)}%` },
      ];
      const cellW = (pageW - margin * 2) / summary.length;
      summary.forEach((s, i) => {
        const cx = margin + cellW * i + cellW / 2;
        pdf.setFontSize(8); pdf.setTextColor(110, 110, 120); pdf.setFont('helvetica', 'normal');
        pdf.text(s.label, cx, finalY + 8, { align: 'center' });
        pdf.setFontSize(13); pdf.setTextColor(20, 20, 30); pdf.setFont('helvetica', 'bold');
        pdf.text(String(s.value), cx, finalY + 16, { align: 'center' });
      });

      // === FOOTER (signatures) ===
      const footerY = finalY + 38;
      pdf.setDrawColor(180, 180, 190);
      pdf.setLineWidth(0.3);
      // Class teacher
      pdf.line(margin, footerY, margin + 55, footerY);
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(90, 90, 100);
      pdf.text('Class Teacher', margin + 27.5, footerY + 4, { align: 'center' });
      // Principal
      pdf.line(pageW - margin - 55, footerY, pageW - margin, footerY);
      pdf.text('Principal', pageW - margin - 27.5, footerY + 4, { align: 'center' });
      // School stamp
      pdf.setDrawColor(180, 180, 190);
      pdf.roundedRect(pageW / 2 - 15, footerY - 12, 30, 18, 2, 2);
      pdf.setFontSize(7); pdf.setTextColor(160, 160, 170);
      pdf.text('SCHOOL STAMP', pageW / 2, footerY - 2, { align: 'center' });

      // Bottom date
      pdf.setFontSize(8); pdf.setTextColor(140, 140, 150);
      pdf.text(`Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageW / 2, footerY + 18, { align: 'center' });

      const safeName = selectedChild.name.replace(/\s+/g, '_');
      pdf.save(`ReportCard_${safeName}.pdf`);
      toast.success('Report card downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Card</h1>
          <p className="text-muted-foreground">
            {selectedChild.name} · {selectedChild.class_name} {selectedChild.section_name}
          </p>
        </div>
        <Button onClick={handleExportPDF} disabled={exporting} className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass card-hover">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Final GPA</p>
            <p className="text-4xl font-bold">
              {finalGPA.hasNG ? <span className="text-destructive">NG</span> : finalGPA.gpa?.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Overall Grade</p>
            <p className="text-4xl font-bold">
              {finalGPA.hasNG ? <span className="text-destructive">NG</span> : overallGrade.letter}
            </p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Marks</p>
            <p className="text-4xl font-bold">
              {totalMarks}<span className="text-lg text-muted-foreground">/{totalMax}</span>
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
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{r.subject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      TH: {r.mark?.theory_marks ?? 0}/{r.subject.th_full_marks} · IN: {r.mark?.internal_marks ?? 0}/{r.subject.in_full_marks}
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
  );
}
