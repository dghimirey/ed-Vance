import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Eye, EyeOff, GraduationCap, BookOpen, ChevronDown, ChevronUp, Trash2, Edit, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TeacherAssignmentsCard from '@/components/TeacherAssignmentsCard';

export default function ClassManagement() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string; numeric_level: number }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string; credit_hours: number }[]>([]);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; code: string; credit_hours: number } | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', class_id: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', credit_hours: 3 });
  const [showClasses, setShowClasses] = useState(false);
  const [showSubjects, setShowSubjects] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

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
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Section added successfully' });
      setSectionDialogOpen(false);
      setSectionForm({ name: '', class_id: '' });
      fetchAll();
    }
  };

  const deleteSection = async (id: string, name: string) => {
    const { error } = await supabase.from('sections').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Section "${name}" deleted successfully` });
      fetchAll();
    }
    setDeleteConfirm(null);
  };

  const addSubject = async () => {
    const { error } = await supabase.from('subjects').insert({
      name: subjectForm.name,
      code: subjectForm.code,
      credit_hours: subjectForm.credit_hours,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Subject added successfully' });
      setSubjectDialogOpen(false);
      setSubjectForm({ name: '', code: '', credit_hours: 3 });
      fetchAll();
    }
  };

  const updateSubject = async () => {
    if (!editingSubject) return;
    const { error } = await supabase.from('subjects').update({
      name: subjectForm.name,
      code: subjectForm.code,
      credit_hours: subjectForm.credit_hours,
    }).eq('id', editingSubject.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Subject updated successfully' });
      setSubjectDialogOpen(false);
      setEditingSubject(null);
      setSubjectForm({ name: '', code: '', credit_hours: 3 });
      fetchAll();
    }
  };

  const deleteSubject = async (id: string, name: string) => {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Subject "${name}" deleted successfully` });
      fetchAll();
    }
    setDeleteConfirm(null);
  };

  const openEditSubject = (subject: { id: string; name: string; code: string; credit_hours: number }) => {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      credit_hours: subject.credit_hours,
    });
    setSubjectDialogOpen(true);
  };

  const openAddSubject = () => {
    setEditingSubject(null);
    setSubjectForm({ name: '', code: '', credit_hours: 3 });
    setSubjectDialogOpen(true);
  };

  const toggleClasses = () => setShowClasses(!showClasses);
  const toggleSubjects = () => setShowSubjects(!showSubjects);
  const toggleClassExpand = (classId: string) => setExpandedClass(expandedClass === classId ? null : classId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes & Subjects</h1>
          <p className="text-muted-foreground">Manage classes, sections, and subjects</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" /> Add Section
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Section</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={sectionForm.class_id} 
                    onChange={e => setSectionForm({...sectionForm, class_id: e.target.value})}
                  >
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Section Name</Label>
                  <Input 
                    value={sectionForm.name} 
                    onChange={e => setSectionForm({...sectionForm, name: e.target.value})} 
                    placeholder="e.g., A, B, C, or Section A" 
                  />
                </div>
                <Button onClick={addSection} disabled={!sectionForm.name || !sectionForm.class_id} className="mt-2">
                  Create Section
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" onClick={openAddSubject}>
                <Plus className="w-4 h-4" /> Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Subject Name</Label>
                  <Input 
                    value={subjectForm.name} 
                    onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} 
                    placeholder="e.g., Mathematics" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject Code</Label>
                  <Input 
                    value={subjectForm.code} 
                    onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} 
                    placeholder="e.g., MATH101" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credit Hours</Label>
                  <Input 
                    type="number"
                    value={subjectForm.credit_hours} 
                    onChange={e => setSubjectForm({...subjectForm, credit_hours: parseInt(e.target.value) || 0})} 
                    placeholder="e.g., 3" 
                    min={1}
                    max={6}
                  />
                </div>
                <Button onClick={editingSubject ? updateSubject : addSubject} disabled={!subjectForm.name || !subjectForm.code} className="mt-2">
                  {editingSubject ? 'Update Subject' : 'Create Subject'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirm Delete</h3>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete {deleteConfirm.type} "{deleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (deleteConfirm.type === 'section') {
                    deleteSection(deleteConfirm.id, deleteConfirm.name);
                  } else if (deleteConfirm.type === 'subject') {
                    deleteSubject(deleteConfirm.id, deleteConfirm.name);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Classes & Sections Card */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Classes & Sections</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleClasses}
                className="gap-2"
              >
                {showClasses ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showClasses ? 'Hide' : 'View'} Classes
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!showClasses ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-2">No classes visible</p>
                <p className="text-sm text-muted-foreground/70">Click "View Classes" to see all classes and their sections</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No classes found</p>
                ) : (
                  classes.map(c => {
                    const classSections = sections.filter(s => s.class_id === c.id);
                    const isExpanded = expandedClass === c.id;
                    return (
                      <div key={c.id} className="rounded-lg border bg-card/50 overflow-hidden">
                        <button
                          onClick={() => toggleClassExpand(c.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">{c.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {classSections.length} section{classSections.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t">
                            {classSections.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">No sections added yet</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {classSections.map(s => (
                                  <div key={s.id} className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-sm px-3 py-1">
                                      Section {s.name}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm({ type: 'section', id: s.id, name: s.name });
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subjects Card */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Subjects</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleSubjects}
                className="gap-2"
              >
                {showSubjects ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSubjects ? 'Hide' : 'View'} Subjects
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!showSubjects ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-2">No subjects visible</p>
                <p className="text-sm text-muted-foreground/70">Click "View Subjects" to see all subjects and their details</p>
              </div>
            ) : (
              <>
                {subjects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No subjects found</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">Subject Name</TableHead>
                          <TableHead className="font-semibold">Code</TableHead>
                          <TableHead className="text-center font-semibold">Credit Hours</TableHead>
                          <TableHead className="text-right font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subjects.map((s, index) => (
                          <TableRow key={s.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono">{s.code}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono">{s.credit_hours} CH</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openEditSubject(s)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:text-destructive"
                                  onClick={() => setDeleteConfirm({ type: 'subject', id: s.id, name: s.name })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <TeacherAssignmentsCard />
    </div>
  );
}
