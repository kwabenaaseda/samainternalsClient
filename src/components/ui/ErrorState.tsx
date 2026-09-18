/**
 * ErrorState Component
 * Displays when an error occurs
 */
import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  message?: string;
  error?: Error | string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  message,
  error,
  retry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {message && (
        <p className="text-gray-500 max-w-sm mb-4">{message}</p>
      )}
      {error && (
        <details className="mb-4 text-left">
          <summary className="text-sm text-gray-500 cursor-pointer">
            View error details
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto">
            {String(error)}
          </pre>
        </details>
      )}
      {retry && (
        <Button onClick={retry} variant="secondary">
          Try again
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
