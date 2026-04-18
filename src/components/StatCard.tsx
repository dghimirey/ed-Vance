import { ReactNode, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

  const TrendIcon = trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend === undefined ? '' : trend > 0 ? 'text-success bg-success/10' : trend < 0 ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-muted';

  return (
    <Card className={cn('glass card-hover animate-slide-up overflow-hidden', className)} style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-3xl font-bold tracking-tight">{displayValue}</p>
              {trend !== undefined && TrendIcon && (
                <span className={cn('text-[11px] font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md', trendColor)}>
                  <TrendIcon className="w-3 h-3" />
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
              )}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-soft">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
