import React from 'react';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  online?: boolean;
  reconnecting?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-xl'
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  photoUrl,
  online,
  reconnecting,
  size = 'md'
}) => {
  const initials = (name || 'G')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="relative inline-flex shrink-0">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className={`${SIZE_CLS[size]} rounded-full object-cover ring-2 ring-cyan-400/40`}
        />
      ) : (
        <div
          className={`${SIZE_CLS[size]} rounded-full bg-gradient-to-br from-cyan-500 via-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center ring-2 ring-white/15 shadow-inner`}
        >
          {initials}
        </div>
      )}
      {typeof online === 'boolean' && (
        <span
          title={reconnecting ? 'Reconnecting...' : online ? 'Online' : 'Offline'}
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#070913] ${
            reconnecting
              ? 'bg-amber-400 animate-pulse'
              : online
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-slate-500'
          }`}
        />
      )}
    </div>
  );
};

