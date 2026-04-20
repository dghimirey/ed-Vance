import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Teacher { user_id: string; name: string; email: string | null }
interface Assignment { id: string; teacher_id: string; class_id: string; section_id: string }
interface Cls { id: string; name: string }
interface Sec { id: string; name: string; class_id: string }

export default function TeacherAssignmentsCard() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [sections, setSections] = useState<Sec[]>([]);
  const [studentCounts, setStudentCounts] = useState<Map<string, number>>(new Map());
  const [open, setOpen] = useState(false);
  const [pickTeacher, setPickTeacher] = useState('');
  const [pickClass, setPickClass] = useState('');
  const [pickSection, setPickSection] = useState('');

  const load = async () => {
    const [rolesRes, asgRes, clsRes, secRes, studRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'teacher'),
      supabase.from('teacher_assignments').select('*'),
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('students').select('class_id, section_id'),
    ]);
    const ids = (rolesRes.data || []).map(r => r.user_id);
    let profiles: { user_id: string; name: string; email: string | null }[] = [];
    if (ids.length > 0) {
      const { data } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
      profiles = data || [];
    }
    const map = new Map(profiles.map(p => [p.user_id, p]));
    setTeachers(ids.map(id => ({ user_id: id, name: map.get(id)?.name || 'Unknown', email: map.get(id)?.email || null })));
    setAssignments(asgRes.data || []);
    setClasses(clsRes.data || []);
    setSections(secRes.data || []);
    const counts = new Map<string, number>();
    (studRes.data || []).forEach(s => {
      const k = `${s.class_id}::${s.section_id}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    setStudentCounts(counts);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('teacher-assignments-card')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_assignments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredSections = sections.filter(s => s.class_id === pickClass);

  const addAssignment = async () => {
    if (!pickTeacher || !pickClass || !pickSection) return;
    const exists = assignments.find(a => a.teacher_id === pickTeacher && a.class_id === pickClass && a.section_id === pickSection);
    if (exists) {
      toast({ title: 'Already assigned', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('teacher_assignments').insert({
      teacher_id: pickTeacher, class_id: pickClass, section_id: pickSection,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Assignment added' });
      setOpen(false);
      setPickTeacher(''); setPickClass(''); setPickSection('');
      load();
    }
  };

  const removeAssignment = async (id: string) => {
    const { error } = await supabase.from('teacher_assignments').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Removed' }); load(); }
  };

  const clsName = (id: string) => classes.find(c => c.id === id)?.name || '—';
  const secName = (id: string) => sections.find(s => s.id === id)?.name || '—';

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Teacher Assignments
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Assign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Teacher to Class</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Teacher</label>
                <Select value={pickTeacher} onValueChange={setPickTeacher}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name}{t.email ? ` · ${t.email}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Class</label>
                  <Select value={pickClass} onValueChange={v => { setPickClass(v); setPickSection(''); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Section</label>
                  <Select value={pickSection} onValueChange={setPickSection}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addAssignment} disabled={!pickTeacher || !pickClass || !pickSection}>Add Assignment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No teachers found. Create teacher accounts in User Management.</p>
        ) : (
          <div className="space-y-3">
            {teachers.map(t => {
              const tAsg = assignments.filter(a => a.teacher_id === t.user_id);
              return (
                <div key={t.user_id} className="p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.email || '—'}</p>
                    </div>
                    <Badge variant={tAsg.length ? 'secondary' : 'outline'} className="text-xs shrink-0">
                      {tAsg.length} {tAsg.length === 1 ? 'class' : 'classes'}
                    </Badge>
                  </div>
                  {tAsg.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tAsg.map(a => (
                        <Badge key={a.id} variant="outline" className="text-xs gap-1 pr-1">
                          {clsName(a.class_id)} — {secName(a.section_id)}
                          <button onClick={() => removeAssignment(a.id)} className="ml-1 hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
