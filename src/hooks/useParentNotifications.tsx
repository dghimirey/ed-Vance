import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import { toast } from 'sonner';
import { useNotificationStore } from '@/hooks/useNotificationStore';

export function useParentNotifications() {
  const { role } = useAuth();
  const { selectedChild } = useChildContext();
  const addNotification = useNotificationStore(s => s.add);

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
            const desc = status ? `Marked as ${status.toUpperCase()}` : 'Attendance record changed';
            toast.success(`Attendance updated for ${childName}`, { description: desc });
            addNotification({ title: `Attendance updated for ${childName}`, description: desc, type: 'attendance' });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marks', filter: `student_id=eq.${childId}` },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const desc = 'A teacher updated grades. Open the Report Card to view.';
            toast.success(`New marks for ${childName}`, { description: desc });
            addNotification({ title: `New marks for ${childName}`, description: desc, type: 'marks' });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, selectedChild?.id, selectedChild?.name, addNotification]);
}
