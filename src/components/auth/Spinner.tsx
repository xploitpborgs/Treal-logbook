interface FullScreenSpinnerProps {
  size?: 'sm' | 'md'
}

export function FullScreenSpinner({ size = 'md' }: FullScreenSpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className={`${sizeClass} animate-spin rounded-full border-2 border-brand`}
        style={{ borderTopColor: 'transparent' }}
      />
    </div>
  )
}
