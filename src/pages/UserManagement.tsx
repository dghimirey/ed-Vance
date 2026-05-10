import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Search, GraduationCap, Users as UsersIcon, ShieldAlert, Loader2, Shield, UserCog, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';

type Role = 'admin' | 'teacher' | 'parent';

interface UserRow {
  user_id: string;
  role: Role;
  name: string;
  email: string;
}
interface ClassItem { id: string; name: string }
interface SectionItem { id: string; name: string; class_id: string }
interface AssignmentRow { id: string; teacher_id: string; class_id: string; section_id: string }
interface StudentRow { id: string; name: string; class_id: string; section_id: string; classes?: { name: string } | null; sections?: { name: string } | null }
interface ParentLink { id: string; parent_id: string; student_id: string; relation: string }

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', name: '', role: 'teacher' as Role });
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Partial<Record<'name'|'email'|'password', string>>>({});
  const [showPwd, setShowPwd] = useState(false);

  // Edit
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'teacher' as Role });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [rolesR, profsR, classesR, sectionsR, asgR, studsR, linksR] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('profiles').select('user_id, name, email'),
      supabase.from('classes').select('id, name').order('numeric_level'),
      supabase.from('sections').select('id, name, class_id'),
      supabase.from('teacher_assignments').select('id, teacher_id, class_id, section_id'),
      supabase.from('students').select('id, name, class_id, section_id, classes(name), sections(name)').order('name'),
      supabase.from('student_parents').select('id, parent_id, student_id, relation'),
    ]);
    const profMap = new Map((profsR.data || []).map(p => [p.user_id, p]));
    const merged: UserRow[] = (rolesR.data || []).map(r => ({
      user_id: r.user_id,
      role: r.role as Role,
      name: profMap.get(r.user_id)?.name || '—',
      email: profMap.get(r.user_id)?.email || '—',
    }));
    setUsers(merged);
    setClasses(classesR.data || []);
    setSections(sectionsR.data || []);
    setAssignments(asgR.data || []);
    setStudents((studsR.data || []) as StudentRow[]);
    setParentLinks(linksR.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id, s.name])), [sections]);

  const teacherAssigns = (teacherId: string) => assignments.filter(a => a.teacher_id === teacherId);
  const parentChildren = (parentId: string) => {
    const ids = new Set(parentLinks.filter(l => l.parent_id === parentId).map(l => l.student_id));
    return students.filter(s => ids.has(s.id));
  };

  const handleCreate = async () => {
    const schema = z.object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
      email: z.string().trim().email('Enter a valid email').max(255),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(72, 'Password too long')
        .regex(/[A-Za-z]/, 'Include at least one letter')
        .regex(/[0-9]/, 'Include at least one number'),
      role: z.enum(['admin','teacher','parent']),
    });
    const parsed = schema.safeParse(createForm);
    if (!parsed.success) {
      const errs: Record<string,string> = {};
      parsed.error.issues.forEach(i => { if (i.path[0]) errs[i.path[0] as string] = i.message; });
      setCreateErrors(errs);
      toast.error('❌ Please fix the highlighted fields');
      return;
    }
    setCreateErrors({});
    setCreating(true);
    const res = await supabase.functions.invoke('admin-create-user', { body: parsed.data });
    setCreating(false);
    if (res.error || res.data?.error) {
      toast.error('❌ Could not create user', { description: res.data?.error || res.error?.message });
    } else {
      toast.success(`✅ ${parsed.data.role.charAt(0).toUpperCase()+parsed.data.role.slice(1)} account created`, {
        description: `${parsed.data.name} can now sign in with ${parsed.data.email}`,
      });
      setCreateOpen(false);
      setCreateForm({ email: '', password: '', name: '', role: 'teacher' });
      fetchAll();
    }
  };

  // Compute dependencies for the delete target from already-loaded data
  const deleteDeps = useMemo(() => {
    if (!deleteTarget) return null;
    if (deleteTarget.role === 'teacher') {
      const items = assignments.filter(a => a.teacher_id === deleteTarget.user_id);
      return {
        kind: 'teacher' as const,
        count: items.length,
        labels: items.map(a => `${classMap.get(a.class_id) || '?'} – ${sectionMap.get(a.section_id) || '?'}`),
      };
    }
    if (deleteTarget.role === 'parent') {
      const kids = parentChildren(deleteTarget.user_id);
      return {
        kind: 'parent' as const,
        count: kids.length,
        labels: kids.map(k => `${k.name} (${k.classes?.name || '?'}-${k.sections?.name || '?'})`),
      };
    }
    return { kind: 'admin' as const, count: 0, labels: [] as string[] };
  }, [deleteTarget, assignments, classMap, sectionMap, parentLinks, students]);

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setEditForm({ name: u.name === '—' ? '' : u.name, email: u.email === '—' ? '' : u.email, password: '', role: u.role });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const body: Record<string, unknown> = { user_id: editTarget.user_id };
    if (editForm.name && editForm.name !== editTarget.name) body.name = editForm.name;
    if (editForm.email && editForm.email !== editTarget.email) body.email = editForm.email;
    if (editForm.password) body.password = editForm.password;
    if (editForm.role !== editTarget.role) body.role = editForm.role;
    const res = await supabase.functions.invoke('admin-update-user', { body });
    setSaving(false);
    if (res.error || res.data?.error) {
      toast.error('❌ Update failed', { description: res.data?.error || res.error?.message });
    } else {
      toast.success('✅ User updated');
      setEditTarget(null);
      fetchAll();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: deleteTarget.user_id, force: forceDelete },
    });
    setDeleting(false);
    if (res.error || res.data?.error) {
      // 409 = dependency conflict — keep dialog open, prompt force
      const msg: string = res.data?.error || res.error?.message || 'Delete failed';
      if (res.data?.dependency) {
        toast.warning(`⚠️ ${msg}`, { description: 'Tick "Force delete" to remove links and continue.' });
      } else {
        toast.error(`❌ ${msg}`);
      }
    } else {
      toast.success('✅ User deleted');
      setDeleteTarget(null);
      setForceDelete(false);
      fetchAll();
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleColors: Record<Role, string> = {
    admin: 'bg-primary/15 text-primary border-primary/30',
    teacher: 'bg-success/15 text-success border-success/30',
    parent: 'bg-warning/15 text-warning border-warning/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage admins, teachers and parents — full control</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Add User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserCog className="w-5 h-5 text-primary" /> Create New User</DialogTitle>
              <DialogDescription>Pick a role, fill in the details, and the account will be ready to sign in immediately.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'admin', label: 'Admin', icon: Shield, hint: 'Full access' },
                    { value: 'teacher', label: 'Teacher', icon: GraduationCap, hint: 'Assigned classes' },
                    { value: 'parent', label: 'Parent', icon: UsersIcon, hint: 'Linked children' },
                  ] as const).map(r => {
                    const active = createForm.role === r.value;
                    const Icon = r.icon;
                    return (
                      <button key={r.value} type="button"
                        onClick={() => setCreateForm({ ...createForm, role: r.value })}
                        className={`group rounded-lg border p-3 text-left transition-all ${active
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : 'border-border/60 hover:border-primary/40 hover:bg-muted/40'}`}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="text-sm font-medium">{r.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{r.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={createForm.name} placeholder="e.g. Sita Sharma"
                  className={createErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  onChange={e => { setCreateForm({...createForm, name: e.target.value}); if (createErrors.name) setCreateErrors({...createErrors, name: undefined}); }} />
                {createErrors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{createErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={createForm.email} placeholder="user@school.edu.np"
                  className={createErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  onChange={e => { setCreateForm({...createForm, email: e.target.value}); if (createErrors.email) setCreateErrors({...createErrors, email: undefined}); }} />
                {createErrors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{createErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPwd ? 'text' : 'password'} value={createForm.password} placeholder="Min 8 chars, letters + numbers"
                    className={`pr-10 ${createErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    onChange={e => { setCreateForm({...createForm, password: e.target.value}); if (createErrors.password) setCreateErrors({...createErrors, password: undefined}); }} />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {createErrors.password
                  ? <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{createErrors.password}</p>
                  : createForm.password && <PasswordStrength value={createForm.password} />}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  Create User
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={v => setRoleFilter(v as 'all' | Role)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="parent">Parents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned / Linked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users match the current filters</TableCell></TableRow>
              ) : filtered.map(u => {
                const isSelf = u.user_id === currentUser?.id;
                let inlineInfo: React.ReactNode = <span className="text-muted-foreground text-xs">—</span>;
                if (u.role === 'teacher') {
                  const asg = teacherAssigns(u.user_id);
                  inlineInfo = asg.length === 0
                    ? <Badge variant="outline" className="border-warning/40 text-warning text-xs">No class assigned</Badge>
                    : (
                      <div className="flex flex-wrap gap-1.5">
                        {asg.slice(0, 3).map(a => (
                          <Badge key={a.id} variant="secondary" className="text-xs">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            {classMap.get(a.class_id) || '?'} – {sectionMap.get(a.section_id) || '?'}
                          </Badge>
                        ))}
                        {asg.length > 3 && <Badge variant="outline" className="text-xs">+{asg.length - 3}</Badge>}
                      </div>
                    );
                } else if (u.role === 'parent') {
                  const kids = parentChildren(u.user_id);
                  inlineInfo = kids.length === 0
                    ? <Badge variant="outline" className="border-warning/40 text-warning text-xs">No students linked</Badge>
                    : (
                      <div className="flex flex-wrap gap-1.5">
                        {kids.slice(0, 3).map(k => (
                          <Badge key={k.id} variant="secondary" className="text-xs">
                            <UsersIcon className="w-3 h-3 mr-1" />
                            {k.name} ({k.classes?.name || '?'}-{k.sections?.name || '?'})
                          </Badge>
                        ))}
                        {kids.length > 3 && <Badge variant="outline" className="text-xs">+{kids.length - 3}</Badge>}
                      </div>
                    );
                }
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.name}{isSelf && <Badge variant="outline" className="ml-2 text-[10px]">you</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize text-xs ${roleColors[u.role]}`}>{u.role}</Badge></TableCell>
                    <TableCell>{inlineInfo}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={isSelf}
                        onClick={() => { setDeleteTarget(u); setForceDelete(false); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update details, change role, or reset password.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="grid gap-5 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>New password (optional)</Label><Input type="password" placeholder="Leave blank to keep" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={v => setEditForm({...editForm, role: v as Role})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editTarget.role === 'teacher' && (
                <TeacherAssignmentsEditor
                  teacherId={editTarget.user_id}
                  classes={classes} sections={sections}
                  assignments={assignments.filter(a => a.teacher_id === editTarget.user_id)}
                  onChange={fetchAll}
                />
              )}
              {editTarget.role === 'parent' && (
                <ParentLinksEditor
                  parentId={editTarget.user_id}
                  students={students}
                  links={parentLinks.filter(l => l.parent_id === editTarget.user_id)}
                  onChange={fetchAll}
                />
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditTarget(null)}>Close</Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" /> Delete user?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) and revoke their access.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && deleteDeps && deleteDeps.count > 0 && (
            <div className="space-y-3">
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  {deleteDeps.kind === 'teacher'
                    ? `${deleteDeps.count} class assignment${deleteDeps.count > 1 ? 's' : ''} will be removed`
                    : `${deleteDeps.count} student link${deleteDeps.count > 1 ? 's' : ''} will be removed`}
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {deleteDeps.labels.slice(0, 8).map((l, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] border-warning/40">{l}</Badge>
                  ))}
                  {deleteDeps.labels.length > 8 && (
                    <Badge variant="outline" className="text-[11px]">+{deleteDeps.labels.length - 8} more</Badge>
                  )}
                </ul>
              </div>
              <label className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm cursor-pointer">
                <Checkbox checked={forceDelete} onCheckedChange={v => setForceDelete(!!v)} className="mt-0.5" />
                <span>
                  <strong>Yes, force delete:</strong> I understand the {deleteDeps.kind === 'teacher' ? 'class assignments' : 'student links'} above will be permanently removed along with this account.
                </span>
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleting || (!!deleteDeps && deleteDeps.count > 0 && !forceDelete)}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const checks = [
    { ok: value.length >= 8, label: '8+ chars' },
    { ok: /[A-Za-z]/.test(value), label: 'letter' },
    { ok: /[0-9]/.test(value), label: 'number' },
    { ok: /[^A-Za-z0-9]/.test(value), label: 'symbol (bonus)' },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-success'];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : 'bg-muted'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {checks.map(c => (
          <span key={c.label} className={c.ok ? 'text-success' : ''}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Inline editors ---------- */

function TeacherAssignmentsEditor({ teacherId, classes, sections, assignments, onChange }: {
  teacherId: string; classes: ClassItem[]; sections: SectionItem[]; assignments: AssignmentRow[]; onChange: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [busy, setBusy] = useState(false);
  const filteredSections = sections.filter(s => s.class_id === classId);
  const classMap = new Map(classes.map(c => [c.id, c.name]));
  const sectionMap = new Map(sections.map(s => [s.id, s.name]));

  const add = async () => {
    if (!classId || !sectionId) return;
    setBusy(true);
    const { error } = await supabase.from('teacher_assignments').insert({ teacher_id: teacherId, class_id: classId, section_id: sectionId });
    setBusy(false);
    if (error) toast.error('❌ Could not assign class', { description: error.message });
    else { toast.success('✅ Class assigned'); setClassId(''); setSectionId(''); onChange(); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('teacher_assignments').delete().eq('id', id);
    if (error) toast.error('❌ Could not remove', { description: error.message });
    else { toast.success('✅ Assignment removed'); onChange(); }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium"><GraduationCap className="w-4 h-4" /> Assigned Classes</div>
      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No classes assigned yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignments.map(a => (
            <Badge key={a.id} variant="secondary" className="gap-1.5 pr-1">
              {classMap.get(a.class_id)} – Section {sectionMap.get(a.section_id)}
              <button className="hover:text-destructive ml-1" onClick={() => remove(a.id)}><Trash2 className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Select value={classId} onValueChange={v => { setClassId(v); setSectionId(''); }}>
          <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
          <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={add} disabled={!classId || !sectionId || busy}>Assign</Button>
      </div>
    </div>
  );
}

function ParentLinksEditor({ parentId, students, links, onChange }: {
  parentId: string; students: StudentRow[]; links: ParentLink[]; onChange: () => void;
}) {
  const [search, setSearch] = useState('');
  const [pickStudent, setPickStudent] = useState('');
  const [relation, setRelation] = useState('guardian');
  const linkedIds = new Set(links.map(l => l.student_id));
  const linked = students.filter(s => linkedIds.has(s.id));
  const available = students.filter(s => !linkedIds.has(s.id) && (!search || s.name.toLowerCase().includes(search.toLowerCase())));

  const add = async () => {
    if (!pickStudent) return;
    const { error } = await supabase.from('student_parents').insert({ parent_id: parentId, student_id: pickStudent, relation });
    if (error) toast.error('❌ Could not link student', { description: error.message });
    else { toast.success('✅ Student linked'); setPickStudent(''); setSearch(''); onChange(); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('student_parents').delete().eq('id', id);
    if (error) toast.error('❌ Could not unlink', { description: error.message });
    else { toast.success('✅ Student unlinked'); onChange(); }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium"><UsersIcon className="w-4 h-4" /> Linked Students</div>
      {linked.length === 0 ? (
        <p className="text-xs text-muted-foreground">No students linked yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map(l => {
            const s = linked.find(x => x.id === l.student_id);
            if (!s) return null;
            return (
              <li key={l.id} className="flex items-center justify-between p-2 rounded-md bg-card border border-border/50">
                <div className="text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground"> · {s.classes?.name}-{s.sections?.name}</span>
                  <Badge variant="outline" className="ml-2 text-[10px] capitalize">{l.relation}</Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(l.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Select value={pickStudent} onValueChange={setPickStudent}>
            <SelectTrigger><SelectValue placeholder={available.length ? 'Select student' : 'No students available'} /></SelectTrigger>
            <SelectContent>
              {available.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} · {s.classes?.name}-{s.sections?.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={relation} onValueChange={setRelation}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="father">Father</SelectItem>
              <SelectItem value="mother">Mother</SelectItem>
              <SelectItem value="guardian">Guardian</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={!pickStudent}>Link</Button>
        </div>
      </div>
    </div>
  );
}