/**
 * EmployeeAvatar — Shows employee photo with initials fallback.
 *
 * Usage:
 *   <EmployeeAvatar name="Müller" firstname="Hans" empId={42} size={32} />
 */
import { useState } from 'react';
import { api } from '../api/client';

interface EmployeeAvatarProps {
  /** Employee ID (used to fetch photo) */
  empId: number;
  /** Last name */
  name: string;
  /** First name */
  firstname?: string;
  /** Size in pixels (default 32) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

export default function EmployeeAvatar({
  empId,
  name,
  firstname = '',
  size = 32,
  className = '',
}: EmployeeAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const photoUrl = api.getEmployeePhotoUrl(empId);

  const initials = (
    (firstname?.charAt(0) || '') + (name?.charAt(0) || '')
  ).toUpperCase() || '?';

  const fontSize = Math.max(10, Math.round(size * 0.38));

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {!imgError ? (
        <img
          src={photoUrl}
          alt={`${firstname} ${name}`}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center bg-wash text-schrift-2 font-semibold"
          style={{ fontSize }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
