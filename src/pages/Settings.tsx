import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, GraduationCap, MapPin, Percent, Calendar, Award, Info, AlertCircle, CheckCircle } from 'lucide-react';

// Type definitions
interface SchoolSettingsType {
  id: string;
  school_name: string;
  address: string;
  pass_percentage: number;
  academic_year: string;
  logo_url: string;
}

// Validation function
const validateSettings = (settings: Partial<SchoolSettingsType>): string[] => {
  const errors: string[] = [];
  
  if (!settings.school_name?.trim()) {
    errors.push('School name is required');
  }
  
  if (!settings.address?.trim()) {
    errors.push('Address is required');
  }
  
  if (settings.pass_percentage === undefined || 
      settings.pass_percentage < 0 || 
      settings.pass_percentage > 100) {
    errors.push('Pass percentage must be between 0 and 100');
  }
  
  if (!settings.academic_year?.trim()) {
    errors.push('Academic year is required');
  }
  
  const academicYearPattern = /^\d{4}\/\d{4}$/;
  if (settings.academic_year && !academicYearPattern.test(settings.academic_year.trim())) {
    errors.push('Academic year must be in format YYYY/YYYY (e.g., 2081/2082)');
  }
  
  return errors;
};

export default function SchoolSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SchoolSettingsType>({
    id: '',
    school_name: '',
    address: '',
    pass_percentage: 35,
    academic_year: '2081/2082',
    logo_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SchoolSettingsType | null>(null);

  // Fetch school settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      
      if (data) {
        const settingsData = data as SchoolSettingsType;
        setSettings(settingsData);
        setOriginalSettings(settingsData);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load school settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Track changes
  useEffect(() => {
    if (originalSettings) {
      const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      setHasChanges(hasUnsavedChanges);
    }
  }, [settings, originalSettings]);

  // Validate field on change
  const validateField = (field: keyof SchoolSettingsType, value: any) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'school_name':
        if (!value?.trim()) {
          newErrors.school_name = 'School name is required';
        } else {
          delete newErrors.school_name;
        }
        break;
      case 'address':
        if (!value?.trim()) {
          newErrors.address = 'Address is required';
        } else {
          delete newErrors.address;
        }
        break;
      case 'pass_percentage':
        if (value < 0 || value > 100) {
          newErrors.pass_percentage = 'Must be between 0 and 100';
        } else {
          delete newErrors.pass_percentage;
        }
        break;
      case 'academic_year':
        const pattern = /^\d{4}\/\d{4}$/;
        if (!value?.trim()) {
          newErrors.academic_year = 'Academic year is required';
        } else if (!pattern.test(value.trim())) {
          newErrors.academic_year = 'Use format: YYYY/YYYY (e.g., 2081/2082)';
        } else {
          delete newErrors.academic_year;
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof SchoolSettingsType, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const handleSave = async () => {
    // Validate all fields before saving
    const validationErrors = validateSettings(settings);
    
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        toast({
          title: 'Validation Error',
          description: error,
          variant: 'destructive',
        });
      });
      return;
    }

    if (!settings.id) {
      toast({
        title: 'Error',
        description: 'Settings record not found. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('school_settings')
        .update({
          school_name: settings.school_name.trim(),
          address: settings.address.trim(),
          pass_percentage: settings.pass_percentage,
          academic_year: settings.academic_year.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Your changes have been applied successfully',
        variant: 'default',
      });
      
      setOriginalSettings({ ...settings });
      setHasChanges(false);
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setErrors({});
      toast({
        title: 'Changes discarded',
        description: 'All unsaved changes have been reset',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto py-8 px-4 max-w-5xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading school settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                School Settings
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your school's general information and academic rules
              </p>
            </div>
            {hasChanges && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Unsaved changes</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          {/* General Settings Card */}
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
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
                  School Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  value={settings.school_name} 
                  onChange={(e) => handleFieldChange('school_name', e.target.value)}
                  className={`transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.school_name ? 'border-red-500 focus:ring-red-500/20' : ''
                  }`}
                  placeholder="Enter school name"
                  disabled={saving}
                />
                {errors.school_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.school_name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Address <span className="text-red-500">*</span>
                </Label>
                <Input 
                  value={settings.address || ''} 
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  className={`transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.address ? 'border-red-500 focus:ring-red-500/20' : ''
                  }`}
                  placeholder="Enter school address"
                  disabled={saving}
                />
                {errors.address && (
                  <p className="text-xs text-red-500 mt-1">{errors.address}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    Pass Percentage (%) <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    type="number" 
                    value={settings.pass_percentage} 
                    onChange={(e) => handleFieldChange('pass_percentage', Number(e.target.value))}
                    className={`transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                      errors.pass_percentage ? 'border-red-500 focus:ring-red-500/20' : ''
                    }`}
                    min="0"
                    max="100"
                    step="1"
                    disabled={saving}
                  />
                  {errors.pass_percentage && (
                    <p className="text-xs text-red-500 mt-1">{errors.pass_percentage}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    value={settings.academic_year} 
                    onChange={(e) => handleFieldChange('academic_year', e.target.value)}
                    className={`transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                      errors.academic_year ? 'border-red-500 focus:ring-red-500/20' : ''
                    }`}
                    placeholder="e.g., 2081/2082"
                    disabled={saving}
                  />
                  {errors.academic_year && (
                    <p className="text-xs text-red-500 mt-1">{errors.academic_year}</p>
                  )}
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button 
                  onClick={handleSave} 
                  disabled={saving || !hasChanges || Object.keys(errors).length > 0}
                  className="transition-all hover:shadow-lg hover:scale-105"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" /> 
                      Save Changes
                    </>
                  )}
                </Button>
                
                {hasChanges && (
                  <Button 
                    onClick={handleReset} 
                    variant="outline"
                    disabled={saving}
                    className="transition-all"
                  >
                    Discard Changes
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1.5 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold">Important Academic Rules:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>NG Rule:</strong> Theory pass mark = 35%, Internal pass mark = 40%. If either is below threshold, subject is marked as NG (Not Graded).</li>
                  <li><strong>Credit Hours:</strong> Total = 32 credits. Split: 75% Theory (24 credits), 25% Internal (8 credits) per subject.</li>
                  <li><strong>Pass Percentage:</strong> The minimum percentage required to pass a subject overall.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
