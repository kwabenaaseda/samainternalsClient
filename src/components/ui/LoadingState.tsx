/**
 * LoadingState Component
 * Displays a loading spinner with optional message
 */

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary mb-4" />
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

export default LoadingState;
