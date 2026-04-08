import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

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

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', gender: 'male', dob: '', father_name: '', mother_name: '',
    symbol_number: '', class_id: '', section_id: '',
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [studRes, classRes, secRes] = await Promise.all([
      supabase.from('students').select('*, classes(name), sections(name)').order('symbol_number'),
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
    ]);
    if (studRes.data) setStudents(studRes.data as Student[]);
    if (classRes.data) setClasses(classRes.data);
    if (secRes.data) setSections(secRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  const displayed = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.symbol_number.includes(search);
    const matchClass = filterClass === 'all' || s.class_id === filterClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage student records</p>
        </div>
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
      </div>

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
            <div className="relative">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
              <Button variant="outline"><Upload className="w-4 h-4 mr-1" /> Bulk Upload</Button>
            </div>
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
                  <TableHead>Father</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : displayed.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No students found</TableCell></TableRow>
                ) : displayed.map((s, i) => (
                  <TableRow key={s.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary">{s.symbol_number}</Badge></TableCell>
                    <TableCell className="capitalize">{s.gender}</TableCell>
                    <TableCell>{s.classes?.name}</TableCell>
                    <TableCell>{s.sections?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.father_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
