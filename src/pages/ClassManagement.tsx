import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TeacherAssignmentsCard from '@/components/TeacherAssignmentsCard';

export default function ClassManagement() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string; numeric_level: number }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string; credit_hours: number }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ name: '', class_id: '' });

  const fetchAll = () => {
    Promise.all([
      supabase.from('classes').select('id, name, numeric_level').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('subjects').select('id, name, code, credit_hours').order('name'),
    ]).then(([c, s, sub]) => {
      if (c.data) setClasses(c.data);
      if (s.data) setSections(s.data);
      if (sub.data) setSubjects(sub.data);
    });
  };

  useEffect(() => { fetchAll(); }, []);

  const addSection = async () => {
    const { error } = await supabase.from('sections').insert({
      name: sectionForm.name, class_id: sectionForm.class_id,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Section added' }); setDialogOpen(false); fetchAll(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes & Subjects</h1>
          <p className="text-muted-foreground">Manage classes, sections, and subjects</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Plus className="w-4 h-4 mr-1" /> Add Section</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={sectionForm.class_id} onChange={e => setSectionForm({...sectionForm, class_id: e.target.value})}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Section Name</Label>
                <Input value={sectionForm.name} onChange={e => setSectionForm({...sectionForm, name: e.target.value})} placeholder="C" />
              </div>
              <Button onClick={addSection} disabled={!sectionForm.name || !sectionForm.class_id}>Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Classes & Sections</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classes.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex gap-1">
                    {sections.filter(s => s.class_id === c.id).map(s => (
                      <Badge key={s.id} variant="secondary" className="text-xs">{s.name}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Subjects</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-center">CH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary">{s.code}</Badge></TableCell>
                    <TableCell className="text-center">{s.credit_hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <TeacherAssignmentsCard />
    </div>
  );
}
