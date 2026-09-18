/**
 * StatCard Component
 * Large number display for dashboard statistics
 */
import { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
}: StatCardProps) {
  return (
    <Card className={`${className} h-full`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="stat-value mt-1">{value}</p>
          {subtitle && <p className="stat-label">{subtitle}</p>}
          {trend && (
            <p
              className={`text-xs mt-2 ${
                trend.positive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.positive ? '↑' : '↓'} {trend.value} {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
