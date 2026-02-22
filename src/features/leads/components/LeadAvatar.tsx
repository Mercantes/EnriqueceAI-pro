'use client';

const COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-amber-500',
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface LeadAvatarProps {
  name: string | null;
  size?: 'sm' | 'default' | 'lg';
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  default: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-xl',
} as const;

export function LeadAvatar({ name, size = 'default' }: LeadAvatarProps) {
  const letter = name ? name.charAt(0).toUpperCase() : '?';
  const colorIndex = name ? hashString(name) % COLORS.length : 0;
  const color = COLORS[colorIndex]!;

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${sizeClasses[size]}`}
    >
      {letter}
    </div>
  );
}
