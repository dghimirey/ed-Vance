import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { toast } from 'sonner';

export function useParentNotifications() {
  const { role } = useAuth();
  const { selectedChild } = useChildContext();

  useEffect(() => {
    if (role !== 'parent' || !selectedChild?.id) return;

    const childId = selectedChild.id;
    const childName = selectedChild.name;

    const channel = supabase
      .channel(`parent-notifications-${childId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `student_id=eq.${childId}` },
        (payload) => {
          const status = (payload.new as { status?: string })?.status;
          const eventType = payload.eventType;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            toast.success(`Attendance updated for ${childName}`, {
              description: status ? `Marked as ${status.toUpperCase()}` : 'Attendance record changed',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marks', filter: `student_id=eq.${childId}` },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            toast.success(`New marks for ${childName}`, {
              description: 'A teacher updated grades. Open the Report Card to view.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, selectedChild?.id, selectedChild?.name]);
}
