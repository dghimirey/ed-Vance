import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Upload, Users, AlertTriangle, Settings2, GraduationCap, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';
import ManageParentsDialog from '@/components/ManageParentsDialog';

interface Student {
  id: string;
  name: string;
  gender: string;
  dob: string | null;
  father_name: string | null;
  mother_name: string | null;
  symbol_number: string;
  class_id: string;
  section_id: string;
  parent_id: string | null;
  classes?: { name: string } | null;
  sections?: { name: string } | null;
}

interface ClassItem { id: string; name: string }
interface SectionItem { id: string; name: string; class_id: string }
interface TeacherAsg { class_id: string; section_id: string }

export default function Students() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [teacherAsg, setTeacherAsg] = useState<TeacherAsg[]>([]);
  const [parentCounts, setParentCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parentsDialog, setParentsDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [form, setForm] = useState({
    name: '', gender: 'male', dob: '', father_name: '', mother_name: '',
    symbol_number: '', class_id: '', section_id: '',
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [studRes, classRes, secRes, asgRes, spRes] = await Promise.all([
      supabase.from('students').select('*, classes(name), sections(name)').order('symbol_number'),
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('teacher_assignments').select('class_id, section_id'),
      supabase.from('student_parents').select('student_id'),
    ]);
    if (studRes.data) setStudents(studRes.data as Student[]);
    if (classRes.data) setClasses(classRes.data);
    if (secRes.data) setSections(secRes.data);
    if (asgRes.data) setTeacherAsg(asgRes.data);
    const counts = new Map<string, number>();
    (spRes.data || []).forEach(r => counts.set(r.student_id, (counts.get(r.student_id) || 0) + 1));
    setParentCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('students-page-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_parents' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_assignments' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from('students').insert({
      name: form.name, gender: form.gender, dob: form.dob || null,
      father_name: form.father_name || null, mother_name: form.mother_name || null,
      symbol_number: form.symbol_number, class_id: form.class_id, section_id: form.section_id,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Student added' });
      setDialogOpen(false);
      setForm({ name: '', gender: 'male', dob: '', father_name: '', mother_name: '', symbol_number: '', class_id: '', section_id: '' });
      fetchData();
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    const toInsert = rows.map(row => ({
      name: row['Name'] || row['name'] || '',
      gender: (row['Gender'] || row['gender'] || 'male').toLowerCase(),
      father_name: row['Father Name'] || row['father_name'] || null,
      symbol_number: String(row['Symbol Number'] || row['symbol_number'] || ''),
      class_id: form.class_id,
      section_id: form.section_id,
    })).filter(s => s.name && s.symbol_number);

    if (!form.class_id || !form.section_id) {
      toast({ title: 'Select class and section first', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('students').insert(toInsert);
    if (error) {
      toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${toInsert.length} students uploaded` });
      fetchData();
    }
    e.target.value = '';
  };

  const filteredSections = sections.filter(s => s.class_id === form.class_id);

  // A student is "unassigned" if no teacher has a teacher_assignments row matching their class+section
  const asgKey = useMemo(() => {
    const set = new Set<string>();
    teacherAsg.forEach(a => set.add(`${a.class_id}::${a.section_id}`));
    return set;
  }, [teacherAsg]);

  const isUnassigned = (s: Student) => !asgKey.has(`${s.class_id}::${s.section_id}`);
  const unassignedCount = useMemo(() => students.filter(isUnassigned).length, [students, asgKey]);

  const displayed = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.symbol_number.includes(search);
    const matchClass = filterClass === 'all' || s.class_id === filterClass;
    const matchUnassigned = !showOnlyUnassigned || isUnassigned(s);
    return matchSearch && matchClass && matchUnassigned;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage student records</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-1" /> Add Student</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Student</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Symbol Number *</Label>
                      <Input value={form.symbol_number} onChange={e => setForm({...form, symbol_number: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={form.gender} onValueChange={v => setForm({...form, gender: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Father's Name</Label>
                      <Input value={form.father_name} onChange={e => setForm({...form, father_name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mother's Name</Label>
                      <Input value={form.mother_name} onChange={e => setForm({...form, mother_name: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Class *</Label>
                      <Select value={form.class_id} onValueChange={v => setForm({...form, class_id: v, section_id: ''})}>
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Section *</Label>
                      <Select value={form.section_id} onValueChange={v => setForm({...form, section_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                        <SelectContent>
                          {filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleCreate} disabled={!form.name || !form.symbol_number || !form.class_id || !form.section_id}>
                    Create Student
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {isAdmin && unassignedCount > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-warning/40 bg-warning/10 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span><strong>{unassignedCount}</strong> student{unassignedCount === 1 ? '' : 's'} have no assigned teacher.</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowOnlyUnassigned(v => !v)}>
            {showOnlyUnassigned ? 'Show All' : 'Filter Unassigned'}
          </Button>
        </div>
      )}

      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <div className="relative">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                <Button variant="outline"><Upload className="w-4 h-4 mr-1" /> Bulk Upload</Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol No.</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  {isAdmin && <TableHead>Status</TableHead>}
                  {isAdmin && <TableHead className="text-right">Parents</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground">
                      {role === 'teacher'
                        ? 'No students visible. Ask an admin to assign you to a class.'
                        : 'No students found.'}
                    </TableCell>
                  </TableRow>
                ) : displayed.map((s, i) => {
                  const pCount = parentCounts.get(s.id) || 0;
                  const unassigned = isUnassigned(s);
                  return (
                    <TableRow key={s.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="secondary">{s.symbol_number}</Badge></TableCell>
                      <TableCell className="capitalize">{s.gender}</TableCell>
                      <TableCell>{s.classes?.name}</TableCell>
                      <TableCell>{s.sections?.name}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {unassigned
                            ? <Badge variant="outline" className="border-warning/50 text-warning">Unassigned</Badge>
                            : <Badge variant="secondary" className="bg-success/15 text-success border-success/30">Assigned</Badge>}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setParentsDialog({ open: true, id: s.id, name: s.name })}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            {pCount > 0 ? `${pCount} linked` : 'Manage'}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ManageParentsDialog
        open={parentsDialog.open}
        onOpenChange={(v) => setParentsDialog(p => ({ ...p, open: v }))}
        studentId={parentsDialog.id}
        studentName={parentsDialog.name}
      />
    </div>
  );
}
