import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
}

interface ParentUser {
  user_id: string;
  name: string;
  email: string | null;
}

interface LinkedParent {
  id: string;
  parent_id: string;
  relation: string;
  name: string;
  email: string | null;
}

export default function ManageParentsDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allParents, setAllParents] = useState<ParentUser[]>([]);
  const [linked, setLinked] = useState<LinkedParent[]>([]);
  const [search, setSearch] = useState('');
  const [pickParent, setPickParent] = useState('');
  const [pickRelation, setPickRelation] = useState('guardian');

  const load = async () => {
    setLoading(true);
    const [rolesRes, linksRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'parent'),
      supabase.from('student_parents').select('id, parent_id, relation').eq('student_id', studentId),
    ]);

    const parentIds = (rolesRes.data || []).map(r => r.user_id);
    const allIds = Array.from(new Set([...parentIds, ...(linksRes.data || []).map(l => l.parent_id)]));

    let profiles: { user_id: string; name: string; email: string | null }[] = [];
    if (allIds.length > 0) {
      const { data } = await supabase.from('profiles').select('user_id, name, email').in('user_id', allIds);
      profiles = data || [];
    }
    const profileMap = new Map(profiles.map(p => [p.user_id, p]));

    setAllParents(parentIds.map(id => ({
      user_id: id,
      name: profileMap.get(id)?.name || 'Unknown',
      email: profileMap.get(id)?.email || null,
    })));

    setLinked((linksRes.data || []).map(l => ({
      id: l.id,
      parent_id: l.parent_id,
      relation: l.relation,
      name: profileMap.get(l.parent_id)?.name || 'Unknown',
      email: profileMap.get(l.parent_id)?.email || null,
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setSearch('');
      setPickParent('');
      setPickRelation('guardian');
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId]);

  const linkedIds = new Set(linked.map(l => l.parent_id));
  const available = allParents.filter(p => !linkedIds.has(p.user_id) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.email || '').toLowerCase().includes(search.toLowerCase())));

  const addParent = async () => {
    if (!pickParent) return;
    setSaving(true);
    const { error } = await supabase.from('student_parents').insert({
      student_id: studentId, parent_id: pickParent, relation: pickRelation,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to link', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Parent linked' });
      setPickParent('');
      load();
    }
  };

  const removeLink = async (id: string) => {
    const { error } = await supabase.from('student_parents').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Parent unlinked' });
      load();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Parents — {studentName}</DialogTitle>
          <DialogDescription>Link one or more parents/guardians to this student.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <h4 className="text-sm font-medium mb-2">Linked Parents ({linked.length})</h4>
              {linked.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-lg">No parents linked yet.</p>
              ) : (
                <div className="space-y-2">
                  {linked.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{l.email || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize text-xs">{l.relation}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLink(l.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Add Parent</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search parents..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Select value={pickParent} onValueChange={setPickParent}>
                  <SelectTrigger><SelectValue placeholder={available.length ? 'Select parent' : 'No parents available'} /></SelectTrigger>
                  <SelectContent>
                    {available.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.name} {p.email ? `· ${p.email}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pickRelation} onValueChange={setPickRelation}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addParent} disabled={!pickParent || saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Link Parent
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
