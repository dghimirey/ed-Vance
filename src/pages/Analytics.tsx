import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { calculateRiskScore } from '@/lib/grading';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const RISK_COLORS = { high: 'hsl(0, 84%, 60%)', medium: 'hsl(38, 92%, 50%)', low: 'hsl(142, 76%, 36%)' };

export default function Analytics() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [riskData, setRiskData] = useState<{ name: string; score: number; level: string }[]>([]);
  const [summary, setSummary] = useState({ high: 0, medium: 0, low: 0 });

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
    supabase.from('students').select('id, name')
      .eq('class_id', selectedClass).eq('section_id', selectedSection)
      .then(async ({ data: students }) => {
        if (!students || students.length === 0) { setRiskData([]); return; }

        const ids = students.map(s => s.id);
        const [marksRes, attRes, assRes] = await Promise.all([
          supabase.from('marks').select('student_id, theory_marks, internal_marks').in('student_id', ids),
          supabase.from('attendance').select('student_id, status').in('student_id', ids),
          supabase.from('assignments').select('student_id, completed').in('student_id', ids),
        ]);

        const risks = students.map(s => {
          const sMarks = (marksRes.data || []).filter(m => m.student_id === s.id);
          const totalObtained = sMarks.reduce((sum, m) => sum + (m.theory_marks || 0) + (m.internal_marks || 0), 0);
          const totalFull = sMarks.length * 100;
          const marksPerc = totalFull > 0 ? (totalObtained / totalFull) * 100 : 50;

          const sAtt = (attRes.data || []).filter(a => a.student_id === s.id);
          const present = sAtt.filter(a => a.status === 'present' || a.status === 'late').length;
          const attPerc = sAtt.length > 0 ? (present / sAtt.length) * 100 : 100;

          const sAss = (assRes.data || []).filter(a => a.student_id === s.id);
          const completed = sAss.filter(a => a.completed).length;
          const assPerc = sAss.length > 0 ? (completed / sAss.length) * 100 : 100;

          const { score, level } = calculateRiskScore(marksPerc, attPerc, assPerc);
          return { name: s.name, score, level };
        });

        risks.sort((a, b) => b.score - a.score);
        setRiskData(risks);
        setSummary({
          high: risks.filter(r => r.level === 'high').length,
          medium: risks.filter(r => r.level === 'medium').length,
          low: risks.filter(r => r.level === 'low').length,
        });
      });
  }, [selectedClass, selectedSection]);

  const filteredSections = sections.filter(s => s.class_id === selectedClass);
  const pieData = [
    { name: 'High Risk', value: summary.high, color: RISK_COLORS.high },
    { name: 'Medium Risk', value: summary.medium, color: RISK_COLORS.medium },
    { name: 'Low Risk', value: summary.low, color: RISK_COLORS.low },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">At-risk detection and performance insights</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Select a class to view analytics
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Risk Scores</CardTitle></CardHeader>
          <CardContent>
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={riskData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {riskData.length > 0 && (
        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">At-Risk Students</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskData.filter(r => r.level === 'high' || r.level === 'medium').map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-medium">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Score: {r.score}</span>
                    <Badge className={cn(
                      'text-xs capitalize',
                      r.level === 'high' ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'
                    )}>
                      {r.level} risk
                    </Badge>
                  </div>
                </div>
              ))}
              {riskData.filter(r => r.level === 'high' || r.level === 'medium').length === 0 && (
                <p className="text-center text-muted-foreground py-4">No at-risk students in this section</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
