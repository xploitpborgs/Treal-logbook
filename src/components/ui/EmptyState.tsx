import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
        <Icon size={22} className="text-zinc-400" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
        <p className="max-w-xs text-sm text-zinc-500">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="mt-2 bg-[#C41E3A] text-white hover:bg-[#a01830]"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
