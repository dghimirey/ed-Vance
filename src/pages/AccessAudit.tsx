import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Download, Search, AlertTriangle, Users, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Row {
  id: string;
  name: string;
  symbol_number: string;
  class_id: string;
  section_id: string;
  className: string;
  sectionName: string;
  parents: { name: string; email: string | null; relation: string }[];
  teachers: { name: string; email: string | null }[];
}

type Status = 'fully' | 'no-parent' | 'no-teacher' | 'orphaned';

function statusOf(r: Row): Status {
  const p = r.parents.length > 0;
  const t = r.teachers.length > 0;
  if (p && t) return 'fully';
  if (!p && !t) return 'orphaned';
  if (!p) return 'no-parent';
  return 'no-teacher';
}

const statusMeta: Record<Status, { label: string; cls: string }> = {
  fully: { label: 'Fully Linked', cls: 'bg-success/15 text-success border-success/30' },
  'no-parent': { label: 'Missing Parent', cls: 'bg-warning/15 text-warning border-warning/30' },
  'no-teacher': { label: 'Missing Teacher', cls: 'bg-warning/15 text-warning border-warning/30' },
  orphaned: { label: 'Orphaned', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function AccessAudit() {
  const { role, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [studRes, clsRes, secRes, spRes, taRes, profRes, rolesRes] = await Promise.all([
        supabase.from('students').select('id, name, symbol_number, class_id, section_id'),
        supabase.from('classes').select('id, name').order('numeric_level'),
        supabase.from('sections').select('id, name'),
        supabase.from('student_parents').select('student_id, parent_id, relation'),
        supabase.from('teacher_assignments').select('teacher_id, class_id, section_id'),
        supabase.from('profiles').select('user_id, name, email'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      const clsMap = new Map((clsRes.data || []).map(c => [c.id, c.name]));
      const secMap = new Map((secRes.data || []).map(s => [s.id, s.name]));
      const profMap = new Map((profRes.data || []).map(p => [p.user_id, p]));
      const teacherIds = new Set((rolesRes.data || []).filter(r => r.role === 'teacher').map(r => r.user_id));

      // teacher_assignments grouped by class+section
      const teachersByCS = new Map<string, { name: string; email: string | null }[]>();
      (taRes.data || []).forEach(a => {
        if (!teacherIds.has(a.teacher_id)) return;
        const k = `${a.class_id}::${a.section_id}`;
        const p = profMap.get(a.teacher_id);
        const arr = teachersByCS.get(k) || [];
        arr.push({ name: p?.name || 'Unknown', email: p?.email || null });
        teachersByCS.set(k, arr);
      });

      // parents grouped by student
      const parentsByStudent = new Map<string, Row['parents']>();
      (spRes.data || []).forEach(sp => {
        const p = profMap.get(sp.parent_id);
        const arr = parentsByStudent.get(sp.student_id) || [];
        arr.push({ name: p?.name || 'Unknown', email: p?.email || null, relation: sp.relation });
        parentsByStudent.set(sp.student_id, arr);
      });

      const composed: Row[] = (studRes.data || []).map(s => ({
        id: s.id,
        name: s.name,
        symbol_number: s.symbol_number,
        class_id: s.class_id,
        section_id: s.section_id,
        className: clsMap.get(s.class_id) || '—',
        sectionName: secMap.get(s.section_id) || '—',
        parents: parentsByStudent.get(s.id) || [],
        teachers: teachersByCS.get(`${s.class_id}::${s.section_id}`) || [],
      }));

      setRows(composed);
      setClasses(clsRes.data || []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel('access-audit')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_parents' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_assignments' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const withP = rows.filter(r => r.parents.length).length;
    const withT = rows.filter(r => r.teachers.length).length;
    const full = rows.filter(r => r.parents.length && r.teachers.length).length;
    const orphan = rows.filter(r => !r.parents.length && !r.teachers.length).length;
    return { total, withP, withT, full, orphan };
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    const ms = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.symbol_number.includes(search);
    const mc = classFilter === 'all' || r.class_id === classFilter;
    const mst = statusFilter === 'all' || statusOf(r) === statusFilter;
    return ms && mc && mst;
  }), [rows, search, classFilter, statusFilter]);

  const exportCSV = () => {
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const header = ['Student', 'Symbol', 'Class', 'Section', 'Parents', 'Teachers', 'Status'].join(',');
    const lines = filtered.map(r => [
      esc(r.name), esc(r.symbol_number), esc(r.className), esc(r.sectionName),
      esc(r.parents.map(p => `${p.name} (${p.relation})`).join('; ')),
      esc(r.teachers.map(t => t.name).join('; ')),
      esc(statusMeta[statusOf(r)].label),
    ].join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/" replace />;

  const stats = [
    { label: 'Total Students', value: summary.total, icon: GraduationCap, color: 'text-primary' },
    { label: 'With Parents', value: summary.withP, icon: Users, color: 'text-info' },
    { label: 'With Teachers', value: summary.withT, icon: ShieldCheck, color: 'text-info' },
    { label: 'Fully Linked', value: summary.full, icon: ShieldCheck, color: 'text-success' },
    { label: 'Orphaned', value: summary.orphan, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Access Audit
          </h1>
          <p className="text-muted-foreground">Review every student's parent and teacher links</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name or symbol..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="fully">Fully Linked</SelectItem>
                <SelectItem value="no-parent">Missing Parent</SelectItem>
                <SelectItem value="no-teacher">Missing Teacher</SelectItem>
                <SelectItem value="orphaned">Orphaned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Parents</TableHead>
                  <TableHead>Teachers</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No results match your filters.</TableCell></TableRow>
                ) : filtered.map(r => {
                  const st = statusOf(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="secondary">{r.symbol_number}</Badge></TableCell>
                      <TableCell>{r.className}</TableCell>
                      <TableCell>{r.sectionName}</TableCell>
                      <TableCell>
                        {r.parents.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.parents.map((p, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{p.name}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.teachers.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.teachers.map((t, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{t.name}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta[st].cls}>{statusMeta[st].label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
