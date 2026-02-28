interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Shared loading spinner used across all pages for consistency.
 */
export function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 dark:text-slate-400">
      <div
        className={`${sizeClasses[size]} border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin`}
      />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}

export default LoadingSpinner;
