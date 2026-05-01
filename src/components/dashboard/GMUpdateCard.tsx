import { timeAgo } from '@/lib/format'
import { formatGMCategory } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { GMUpdate, Priority } from '@/types'

// ─── Priority badge colors (matches all other cards) ────────────────────────

const PRIORITY_BADGE: Record<Priority, string> = {
  low:    'bg-zinc-100 text-zinc-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-[#C41E3A]/10 text-[#C41E3A]',
}

// ─── Avatar initials helper ─────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Component ─────────────────────────────────────────────────────────────

interface GMUpdateCardProps {
  update: GMUpdate
  onClick?: () => void
}

export function GMUpdateCard({ update, onClick }: GMUpdateCardProps) {
  const authorName = update.author?.full_name ?? 'General Manager'
  const catLabel   = formatGMCategory(update.category)

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow',
        'border-l-2 border-l-amber-400',
        onClick && 'cursor-pointer hover:shadow-md hover:border-zinc-300',
      )}
    >
      {/* Top row: priority + category badges */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
          PRIORITY_BADGE[update.priority],
        )}>
          {update.priority}
        </span>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {catLabel}
        </span>
      </div>

      {/* GM Directive label */}
      <p className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-1">
        GM Directive
      </p>

      {/* Title */}
      <h3 className="text-base font-medium text-zinc-900 truncate mb-1">
        {update.title}
      </h3>

      {/* Body preview */}
      <p className="text-sm text-zinc-500 line-clamp-2">
        {update.body}
      </p>

      {/* Bottom row: author + time */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-[9px] font-semibold text-white">
          {initials(authorName)}
        </div>
        <span className="text-xs text-zinc-500">
          GM · {authorName}
        </span>
        <span className="text-zinc-300">·</span>
        <span className="text-xs text-zinc-400">{timeAgo(update.created_at)}</span>
      </div>
    </div>
  )
}
