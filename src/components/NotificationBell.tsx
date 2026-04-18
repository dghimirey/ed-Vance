import { Bell, CheckCheck, Trash2, CalendarCheck, GraduationCap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationStore } from '@/hooks/useNotificationStore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const iconFor = (type: string) => {
  if (type === 'attendance') return CalendarCheck;
  if (type === 'marks') return GraduationCap;
  return Info;
};

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clear } = useNotificationStore();

  return (
    <Popover onOpenChange={(open) => { if (open && unreadCount > 0) setTimeout(markAllRead, 800); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-ping" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 overflow-hidden animate-scale-in"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllRead} title="Mark all read">
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clear} title="Clear all">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[380px]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => {
                const Icon = iconFor(n.type);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                      !n.read && 'bg-primary/5'
                    )}
                  >
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                      n.type === 'attendance' && 'bg-success/10 text-success',
                      n.type === 'marks' && 'bg-primary/10 text-primary',
                      n.type === 'info' && 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-tight', !n.read && 'font-semibold')}>
                        {n.title}
                      </p>
                      {n.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
