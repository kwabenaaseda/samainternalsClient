/**
 * Card Component
 * Reusable card container for dashboard cards and content sections
 */
import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={`card ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Card Header component
 */
interface CardHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * Card Body component
 */
export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}
