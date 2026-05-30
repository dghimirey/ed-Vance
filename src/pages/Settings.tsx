import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, GraduationCap, MapPin, Percent, Calendar, Award, Info } from 'lucide-react';

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
    else toast({ title: 'Settings saved', description: 'Your changes have been applied successfully' });
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        {/* Header with icon */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                School Settings
              </h1>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* General Settings Card */}
          <Card className="md:col-span-2 border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  School Name
                </Label>
                <Input 
                  value={settings.school_name} 
                  onChange={e => setSettings({...settings, school_name: e.target.value})}
                  className="transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter school name"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Address
                </Label>
                <Input 
                  value={settings.address || ''} 
                  onChange={e => setSettings({...settings, address: e.target.value})}
                  className="transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter school address"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Pass Percentage
                  </Label>
                  <Input 
                    type="number" 
                    value={settings.pass_percentage} 
                    onChange={e => setSettings({...settings, pass_percentage: Number(e.target.value)})}
                    className="transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Academic Year
                  </Label>
                  <Input 
                    value={settings.academic_year} 
                    onChange={e => setSettings({...settings, academic_year: e.target.value})}
                    className="transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g., 2081/2082"
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="w-full sm:w-auto transition-all hover:shadow-lg hover:scale-105"
                >
                  <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} /> 
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>  
              {/* Info box with better styling */}
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">Important Notes:</p>
                    <p>• <strong>NG Rule:</strong> TH pass mark = 35%, IN pass mark = 40%. If either is below, subject is NG.</p>
                    <p>• <strong>Credit Hours:</strong> Total = 32. Split: 75% TH, 25% IN per subject.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
