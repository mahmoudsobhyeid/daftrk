interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const gradients = [
  'from-primary-500 to-primary-700',
  'from-accent-400 to-accent-600',
  'from-success-500 to-success-700',
  'from-warning-400 to-warning-600',
  'from-danger-400 to-danger-600',
  'from-primary-400 to-accent-500',
];

function getGradient(name: string): string {
  const index = name.charCodeAt(0) % gradients.length;
  return gradients[index];
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ring-2 ring-white dark:ring-secondary-800 ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${getGradient(name)} font-bold text-white ring-2 ring-white dark:ring-secondary-800 shrink-0 ${sizes[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
