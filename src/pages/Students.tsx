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

interface ParentInfo { name: string; email: string | null; relation: string }
interface TeacherInfo { name: string; email: string | null }

export default function Students() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [teacherAsg, setTeacherAsg] = useState<TeacherAsg[]>([]);
  const [parentsByStudent, setParentsByStudent] = useState<Map<string, ParentInfo[]>>(new Map());
  const [teachersByCS, setTeachersByCS] = useState<Map<string, TeacherInfo[]>>(new Map());
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
    const [studRes, classRes, secRes, asgRes, spRes, profRes, rolesRes] = await Promise.all([
      supabase.from('students').select('*, classes(name), sections(name)').order('symbol_number'),
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('teacher_assignments').select('teacher_id, class_id, section_id'),
      supabase.from('student_parents').select('student_id, parent_id, relation'),
      supabase.from('profiles').select('user_id, name, email'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    if (studRes.data) setStudents(studRes.data as Student[]);
    if (classRes.data) setClasses(classRes.data);
    if (secRes.data) setSections(secRes.data);
    if (asgRes.data) setTeacherAsg(asgRes.data);

    const profMap = new Map((profRes.data || []).map(p => [p.user_id, p]));
    const teacherIds = new Set((rolesRes.data || []).filter(r => r.role === 'teacher').map(r => r.user_id));

    const pMap = new Map<string, ParentInfo[]>();
    (spRes.data || []).forEach(sp => {
      const p = profMap.get(sp.parent_id);
      const arr = pMap.get(sp.student_id) || [];
      arr.push({ name: p?.name || 'Unknown', email: p?.email || null, relation: sp.relation });
      pMap.set(sp.student_id, arr);
    });
    setParentsByStudent(pMap);

    const tMap = new Map<string, TeacherInfo[]>();
    (asgRes.data || []).forEach(a => {
      if (!teacherIds.has(a.teacher_id)) return;
      const k = `${a.class_id}::${a.section_id}`;
      const p = profMap.get(a.teacher_id);
      const arr = tMap.get(k) || [];
      arr.push({ name: p?.name || 'Unknown', email: p?.email || null });
      tMap.set(k, arr);
    });
    setTeachersByCS(tMap);
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

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ class_id: '', section_id: '' });
  const bulkSections = sections.filter(s => s.class_id === bulkForm.class_id);

  const downloadTemplate = () => {
    const sample = [
      { Name: 'Ram Sharma', 'Symbol Number': '0001', Gender: 'male', 'Date of Birth': '2010-05-12', 'Father Name': 'Hari Sharma', 'Mother Name': 'Sita Sharma' },
      { Name: 'Sita Adhikari', 'Symbol Number': '0002', Gender: 'female', 'Date of Birth': '2011-08-21', 'Father Name': 'Ram Adhikari', 'Mother Name': 'Gita Adhikari' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students_template.xlsx');
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!bulkForm.class_id || !bulkForm.section_id) {
      toast({ title: 'Select class and section first', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    const toInsert = rows.map(row => ({
      name: row['Name'] || row['name'] || '',
      gender: String(row['Gender'] || row['gender'] || 'male').toLowerCase(),
      dob: row['Date of Birth'] || row['dob'] || null,
      father_name: row['Father Name'] || row['father_name'] || null,
      mother_name: row['Mother Name'] || row['mother_name'] || null,
      symbol_number: String(row['Symbol Number'] || row['symbol_number'] || ''),
      class_id: bulkForm.class_id,
      section_id: bulkForm.section_id,
    })).filter(s => s.name && s.symbol_number);

    if (toInsert.length === 0) {
      toast({ title: 'No valid rows found', description: 'Make sure your file has Name and Symbol Number columns.', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const { error } = await supabase.from('students').insert(toInsert);
    if (error) {
      toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${toInsert.length} students uploaded` });
      setBulkOpen(false);
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
                  {isAdmin && <TableHead className="text-right">Relationships</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-10 text-muted-foreground">
                      {role === 'teacher'
                        ? 'No students visible. Ask an admin to assign you to a class.'
                        : students.length === 0
                          ? 'No students yet. Click "Add Student" to create one.'
                          : 'No students match the current filters. Try clearing search or class filter.'}
                    </TableCell>
                  </TableRow>
                ) : displayed.map((s, i) => {
                  const parents = parentsByStudent.get(s.id) || [];
                  const teachers = teachersByCS.get(`${s.class_id}::${s.section_id}`) || [];
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
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Users className="w-4 h-4 mr-1" />
                                {parents.length}P · {teachers.length}T
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80 p-0">
                              <div className="p-3 border-b">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked Parents</p>
                                {parents.length === 0 ? (
                                  <div className="flex items-center gap-2 text-xs text-warning mt-2">
                                    <AlertCircle className="w-3.5 h-3.5" /> No parents linked
                                  </div>
                                ) : (
                                  <ul className="mt-2 space-y-1.5">
                                    {parents.map((p, idx) => (
                                      <li key={idx} className="text-sm">
                                        <div className="font-medium truncate">{p.name} <span className="text-xs text-muted-foreground capitalize">· {p.relation}</span></div>
                                        <div className="text-xs text-muted-foreground truncate">{p.email || '—'}</div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div className="p-3 border-b">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                  <GraduationCap className="w-3.5 h-3.5" /> Assigned Teachers
                                </p>
                                {teachers.length === 0 ? (
                                  <div className="flex items-center gap-2 text-xs text-warning mt-2">
                                    <AlertCircle className="w-3.5 h-3.5" /> No teacher assigned to {s.classes?.name} / {s.sections?.name}
                                  </div>
                                ) : (
                                  <ul className="mt-2 space-y-1.5">
                                    {teachers.map((t, idx) => (
                                      <li key={idx} className="text-sm">
                                        <div className="font-medium truncate">{t.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">{t.email || '—'}</div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div className="p-2">
                                <Button
                                  variant="ghost" size="sm" className="w-full justify-start"
                                  onClick={() => setParentsDialog({ open: true, id: s.id, name: s.name })}
                                >
                                  <Settings2 className="w-4 h-4 mr-2" /> Manage Parents
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
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
