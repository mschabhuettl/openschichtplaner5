/**
 * PageHeader — konsistenter Seitentitel + optionaler Subtitle + Aktionen
 */

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Elemente rechts (Buttons, Badges, etc.) */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-4 flex-wrap ${className}`}>
      <div>
        <h1 className="text-xl font-bold text-gray-800 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
