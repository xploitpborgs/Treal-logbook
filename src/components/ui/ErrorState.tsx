import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertCircle size={22} className="text-[#a31e22]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-zinc-900">Something went wrong</h3>
        <p className="max-w-xs text-sm text-zinc-500">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-2">
          Try again
        </Button>
      )}
    </div>
  )
}
