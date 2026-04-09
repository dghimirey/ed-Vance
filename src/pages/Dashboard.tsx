import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StatCard } from '@/components/StatCard';
import { Users, GraduationCap, CalendarCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ParentDashboard from '@/components/ParentDashboard';

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, attendance: 0, atRisk: 0 });

  useEffect(() => {
    if (role === 'parent') return;
    const fetchStats = async () => {
      const [studentsRes, teachersRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      ]);
      setStats(prev => ({
        ...prev,
        students: studentsRes.count ?? 0,
        teachers: teachersRes.count ?? 0,
      }));
    };
    fetchStats();
  }, [role]);

  if (role === 'parent') {
    return <ParentDashboard />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {role === 'admin' ? 'School overview and management' : 'Your class overview'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={stats.students} icon={<GraduationCap className="w-6 h-6 text-primary" />} delay={0} />
        <StatCard title="Teachers" value={stats.teachers} icon={<Users className="w-6 h-6 text-primary" />} delay={100} />
        <StatCard title="Attendance Today" value={stats.attendance} icon={<CalendarCheck className="w-6 h-6 text-primary" />} description="Present students" delay={200} />
        <StatCard title="At-Risk Students" value={stats.atRisk} icon={<AlertTriangle className="w-6 h-6 text-warning" />} delay={300} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass animate-slide-up" style={{ animationDelay: '400ms' }}>
          <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {role === 'admin' && (
              <>
                <p>• Manage students, teachers, and parents from the sidebar</p>
                <p>• View and export the Grade Ledger under "Grade Ledger"</p>
                <p>• Configure school settings and grading scales</p>
                <p>• Run student promotions at end of term</p>
              </>
            )}
            {role === 'teacher' && (
              <>
                <p>• Record daily attendance for your class</p>
                <p>• Enter marks (Theory + Internal) for each subject</p>
                <p>• Track assignment completion</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass animate-slide-up" style={{ animationDelay: '500ms' }}>
          <CardHeader><CardTitle className="text-lg">Grading System</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              {[
                { grade: 'A+', range: '90%+', gp: '4.0' },
                { grade: 'A', range: '80-89%', gp: '3.6' },
                { grade: 'B+', range: '70-79%', gp: '3.2' },
                { grade: 'B', range: '60-69%', gp: '2.8' },
                { grade: 'C+', range: '50-59%', gp: '2.4' },
                { grade: 'C', range: '40-49%', gp: '2.0' },
                { grade: 'D', range: '35-39%', gp: '1.6' },
                { grade: 'NG', range: '<35%', gp: '0.0' },
              ].map(g => (
                <div key={g.grade} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                  <span className="font-medium">{g.grade}</span>
                  <span className="text-muted-foreground">{g.range}</span>
                  <span className="text-muted-foreground">GP: {g.gp}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
