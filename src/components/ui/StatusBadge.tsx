/**
 * StatusBadge Component
 * Displays status with appropriate color coding
 */

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

export function StatusBadge({ label, variant = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {label}
    </span>
  );
}

/**
 * Helper function to determine badge variant from status string
 */
export function getStatusVariant(status: string): BadgeVariant {
  const lower = status.toLowerCase();
  if (lower.includes('active') || lower.includes('paid') || lower.includes('in stock')) {
    return 'success';
  }
  if (lower.includes('partial') || lower.includes('low') || lower.includes('pending')) {
    return 'warning';
  }
  if (lower.includes('voided') || lower.includes('withdrawn') || lower.includes('inactive') || lower.includes('out of stock')) {
    return 'danger';
  }
  if (lower.includes('school') || lower.includes('feeding')) {
    return 'info';
  }
  return 'neutral';
}
