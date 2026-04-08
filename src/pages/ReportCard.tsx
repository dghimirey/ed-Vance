import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { calculateSubjectGP, calculateFinalGPA, getGradeFromPercentage } from '@/lib/grading';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface Child { id: string; name: string; symbol_number: string; class_id: string }
interface Mark { subject_id: string; theory_marks: number; internal_marks: number }
interface Subject { id: string; name: string; credit_hours: number; th_full_marks: number; in_full_marks: number }

export default function ReportCard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('students').select('id, name, symbol_number, class_id').eq('parent_id', user.id),
      supabase.from('subjects').select('*').order('name'),
    ]).then(([c, s]) => {
      if (c.data) {
        setChildren(c.data);
        if (c.data.length > 0) setSelectedChild(c.data[0].id);
      }
      if (s.data) setSubjects(s.data as Subject[]);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedChild) return;
    supabase.from('marks').select('subject_id, theory_marks, internal_marks')
      .eq('student_id', selectedChild)
      .then(({ data }) => setMarks((data || []) as Mark[]));
  }, [selectedChild]);

  const child = children.find(c => c.id === selectedChild);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Card</h1>
          <p className="text-muted-foreground">{child?.name || 'Select a child'}</p>
        </div>
        {children.length > 1 && (
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {child && (
        <>
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
        </>
      )}

      {children.length === 0 && (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            No children linked to your account
          </CardContent>
        </Card>
      )}
    </div>
  );
}
