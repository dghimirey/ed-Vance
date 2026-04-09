import { ReactNode, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  description?: string;
  trend?: number;
  className?: string;
  delay?: number;
}

export function StatCard({ title, value, icon, description, trend, className, delay = 0 }: StatCardProps) {
  const isNumeric = typeof value === 'number';
  const [displayValue, setDisplayValue] = useState<number | string>(isNumeric ? 0 : value);

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(value);
      return;
    }
    const numVal = value as number;
    const timer = setTimeout(() => {
      const duration = 1000;
      const steps = 30;
      const increment = numVal / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= numVal) {
          setDisplayValue(numVal);
          clearInterval(interval);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay, isNumeric]);

  return (
    <Card className={cn('glass animate-slide-up overflow-hidden', className)} style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight">{displayValue}</p>
              {trend !== undefined && (
                <span className={cn(
                  'text-xs font-medium',
                  trend >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {trend >= 0 ? '+' : ''}{trend}%
                </span>
              )}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
