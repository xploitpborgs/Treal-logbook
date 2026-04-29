import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { timeAgo } from '@/lib/format'
import { DEPT_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/constants'
import type { LogEntry } from '@/types'

interface LogFeedProps {
  entries: LogEntry[]
  loading: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-zinc-100 text-zinc-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
  escalated: 'bg-[#a31e22] text-white',
}

const PRIORITY_BORDER: Record<string, string> = {
  low: '#a1a1aa',
  medium: '#3b82f6',
  high: '#f97316',
  urgent: '#a31e22',
}

export function LogFeed({ entries, loading }: LogFeedProps) {
  if (loading) return <LogFeedSkeleton />

  if (entries.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
        <p className="text-sm font-medium text-zinc-500">No entries found</p>
        <p className="text-xs text-zinc-400">Try adjusting your filters or create a new entry</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(entry => (
        <LogEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function LogEntryCard({ entry }: { entry: LogEntry }) {
  return (
    <Link
      to="/issues/$issueId"
      params={{ issueId: entry.id }}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: PRIORITY_BORDER[entry.priority] }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                PRIORITY_COLORS[entry.priority],
              )}
            >
              {PRIORITY_LABELS[entry.priority]}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_COLORS[entry.status],
              )}
            >
              {STATUS_LABELS[entry.status]}
            </span>
            <Badge variant="outline" className="h-5 rounded-full px-2 text-xs font-normal text-zinc-500">
              {DEPT_LABELS[entry.department]}
            </Badge>
          </div>

          <h3 className="mt-2 text-sm font-semibold text-zinc-900 leading-snug">{entry.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{entry.body}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs text-zinc-400 whitespace-nowrap">{timeAgo(entry.created_at)}</span>
          {entry.author && (
            <Avatar className="h-7 w-7">
              <AvatarImage src={entry.author.avatar_url ?? undefined} />
              <AvatarFallback className="bg-zinc-200 text-[10px] text-zinc-600">
                {getInitials(entry.author.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      {entry.author && (
        <p className="mt-2 text-xs text-zinc-400">
          {entry.author.full_name} · {DEPT_LABELS[entry.author.department]}
        </p>
      )}
    </Link>
  )
}

function LogFeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-4"
          style={{ borderLeftWidth: 4, borderLeftColor: '#e4e4e7' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
