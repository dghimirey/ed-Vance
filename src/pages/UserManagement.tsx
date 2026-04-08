import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserWithRole {
  user_id: string;
  role: string;
  profiles: { name: string; email: string } | null;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'teacher' });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('user_roles')
      .select('user_id, role, profiles(name, email)');
    setUsers((data || []) as unknown as UserWithRole[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name } },
    });

    if (authError || !authData.user) {
      toast({ title: 'Error', description: authError?.message || 'Failed to create user', variant: 'destructive' });
      setCreating(false);
      return;
    }

    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: authData.user.id,
      role: form.role as 'admin' | 'teacher' | 'parent',
    });

    if (roleError) {
      toast({ title: 'User created but role assignment failed', description: roleError.message, variant: 'destructive' });
    } else {
      toast({ title: `${form.role} account created` });
    }

    setDialogOpen(false);
    setForm({ email: '', password: '', name: '', role: 'teacher' });
    setCreating(false);
    fetchUsers();
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-primary text-primary-foreground',
    teacher: 'bg-success text-success-foreground',
    parent: 'bg-warning text-warning-foreground',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage teachers, parents, and admins</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating || !form.email || !form.password || !form.name}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
              ) : users.map(u => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.profiles?.name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{u.profiles?.email || '—'}</TableCell>
                  <TableCell>
                    <Badge className={`capitalize text-xs ${roleColors[u.role] || ''}`}>{u.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
