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
    <div
      className="flex flex-col items-center justify-center py-20 gap-3 text-schrift-2"
      role="status"
      aria-live="polite"
    >
      <div
        className={`${sizeClasses[size]} border-kontur border-t-glut rounded-full animate-spin`}
        aria-hidden="true"
      />
      {/* Always expose an accessible loading label, even when no visible message is given. */}
      <span className={message ? 'text-sm' : 'sr-only'}>{message ?? 'Wird geladen …'}</span>
    </div>
  );
}

export default LoadingSpinner;
