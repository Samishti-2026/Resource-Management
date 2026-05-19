export default function LoadingSpinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4 border-2', md: 'w-7 h-7 border-2', lg: 'w-10 h-10 border-[3px]' };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${s[size]} border-blue-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export function InlineLoader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
      <LoadingSpinner size="sm" />
      <span>{text}</span>
    </div>
  );
}
