import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

export default function SchoolSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    id: '', school_name: '', address: '', pass_percentage: 35, academic_year: '2081/2082', logo_url: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('school_settings').select('*').limit(1).single()
      .then(({ data }) => { if (data) setSettings(data as any); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('school_settings')
      .update({
        school_name: settings.school_name,
        address: settings.address,
        pass_percentage: settings.pass_percentage,
        academic_year: settings.academic_year,
      })
      .eq('id', settings.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Settings saved' });
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">School Settings</h1>
        <p className="text-muted-foreground">Configure your institution</p>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>School Name</Label>
            <Input value={settings.school_name} onChange={e => setSettings({...settings, school_name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={settings.address || ''} onChange={e => setSettings({...settings, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pass Percentage (%)</Label>
              <Input type="number" value={settings.pass_percentage} onChange={e => setSettings({...settings, pass_percentage: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Input value={settings.academic_year} onChange={e => setSettings({...settings, academic_year: e.target.value})} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Grading Scale (Directive 2078)</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm space-y-1">
            {[
              { grade: 'A+', range: '90% and above', gp: '4.0', desc: 'Outstanding' },
              { grade: 'A', range: '80% to < 90%', gp: '3.6', desc: 'Excellent' },
              { grade: 'B+', range: '70% to < 80%', gp: '3.2', desc: 'Very Good' },
              { grade: 'B', range: '60% to < 70%', gp: '2.8', desc: 'Good' },
              { grade: 'C+', range: '50% to < 60%', gp: '2.4', desc: 'Satisfactory' },
              { grade: 'C', range: '40% to < 50%', gp: '2.0', desc: 'Acceptable' },
              { grade: 'D', range: '35% to < 40%', gp: '1.6', desc: 'Basic' },
              { grade: 'NG', range: 'Below 35%', gp: '0.0', desc: 'Non-Graded (Fail)' },
            ].map(g => (
              <div key={g.grade} className="grid grid-cols-4 py-2 border-b border-border/50 last:border-0">
                <span className="font-semibold">{g.grade}</span>
                <span className="text-muted-foreground">{g.range}</span>
                <span className="text-muted-foreground">GP: {g.gp}</span>
                <span className="text-muted-foreground">{g.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p><strong>NG Rule:</strong> TH pass mark = 35%, IN pass mark = 40%. If either is below, subject is NG.</p>
            <p><strong>Credit Hours:</strong> Total = 32. Split: 75% TH, 25% IN per subject.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
