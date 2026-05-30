import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface ExamAccessRow {
  id: string;
  term: string;
  is_open: boolean;
  updated_at: string;
}

const TERMS = ['First Term', 'Second Term', 'Third Term'];

export default function ExamAccess() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<ExamAccessRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('exam_access').select('*');
    if (error) {
      toast.error('Unable to load exam access settings', { description: error.message });
      return;
    }
    setRows((data || []) as ExamAccessRow[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('exam_access')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_access' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (role !== 'admin') {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center text-muted-foreground">
          You do not have permission to view this page. Only administrators can manage exam access.
        </CardContent>
      </Card>
    );
  }

  const toggle = async (term: string, next: boolean) => {
    setBusy(term);
    
    // Optimistically update the local state
    setRows(currentRows => 
      currentRows.map(row => 
        row.term === term 
          ? { ...row, is_open: next, updated_at: new Date().toISOString() }
          : next ? { ...row, is_open: false } // Turn off all other terms when opening one
          : row
      )
    );
    
    const { error } = await supabase
      .from('exam_access')
      .update({ is_open: next, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('term', term);
      
    setBusy(null);
    if (error) {
      // Revert on error
      await load();
      toast.error('Unable to update exam access', {
        description: `Could not ${next ? 'open' : 'lock'} ${term}: ${error.message}`,
      });
      return;
    }
    toast.success(next ? `${term} opened for editing` : `${term} locked`, {
      description: next ? 'Other terms have been automatically locked.' : 'Teachers can no longer edit marks for this term.',
    });
  };

  const openTerm = rows.find(r => r.is_open)?.term;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exam Access Control</h1>
        <p className="text-muted-foreground">
          Open exactly one term for teachers to enter marks. All other terms are automatically locked to view-only.
        </p>
      </div>

      {openTerm ? (
        <Card className="glass border-success/40 bg-success/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Unlock className="w-5 h-5 text-success" />
            <div>
              <p className="font-medium">Currently editable: <span className="text-success">{openTerm}</span></p>
              <p className="text-xs text-muted-foreground">All other terms are locked.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-warning/40 bg-warning/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-warning" />
            <div>
              <p className="font-medium">All terms are locked</p>
              <p className="text-xs text-muted-foreground">Teachers can only view marks. Open a term below to allow editing.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {TERMS.map(term => {
          const row = rows.find(r => r.term === term);
          const open = row?.is_open ?? false;
          return (
            <Card key={term} className={`glass transition-all ${open ? 'border-success/40 ring-1 ring-success/20' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    {term}
                  </CardTitle>
                  <Badge variant={open ? 'default' : 'secondary'} className={open ? 'bg-success text-success-foreground' : ''}>
                    {open ? 'Open for Editing' : 'Locked / View Only'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Allow teacher edits</span>
                  <Switch
                    checked={open}
                    disabled={busy === term}
                    onCheckedChange={(v) => toggle(term, v)}
                  />
                </div>
                {row?.updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Last changed: {format(new Date(row.updated_at), 'MMM d, yyyy HH:mm')}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
