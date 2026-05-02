import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'
import { useAuthContext } from '@/lib/AuthContext'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/format'
import { DEPT_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/constants'
import { MessageSquare } from 'lucide-react'
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
  open:        'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved:    'bg-green-50 text-green-700',
  escalated:   'bg-[#C41E3A] text-white',
}

const PRIORITY_BORDER: Record<string, string> = {
  low:    'border-l-zinc-300',
  medium: 'border-l-blue-500',
  high:   'border-l-orange-500',
  urgent: 'border-l-[#C41E3A]',
}

function CommentCountBadge({ entryId }: { entryId: string }) {
  const { profile } = useAuthContext()
  const [count, setCount] = useState<number | null>(null)
  const [hasNew, setHasNew] = useState(false)
  
  useEffect(() => {
    const fetchStats = async () => {
      const { data, count: exactCount } = await supabase
        .from('log_comments')
        .select('created_at, author_id', { count: 'exact' })
        .eq('entry_id', entryId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      setCount(exactCount)
      
      if (data && data.length > 0) {
        const newest = data[0]
        if (newest.author_id !== profile?.id) {
          const latest = new Date(newest.created_at).getTime()
          const lastSeen = localStorage.getItem(`last_seen_comments_log_${entryId}`)
          if (!lastSeen || latest > parseInt(lastSeen)) {
            setHasNew(true)
          }
        }
      }
    }
    fetchStats()

    // Listen for new comments
    const channel = supabase
      .channel(`log-comments-count-${entryId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'log_comments',
        filter: `entry_id=eq.${entryId}`
      }, (payload) => { 
        fetchStats()
        const newComment = payload.new as any
        if (newComment.author_id !== profile?.id) {
          setHasNew(true)
        }
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [entryId])

  if (!count || count === 0) return null

  return (
    <div className="relative">
      <div className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all",
        hasNew 
          ? "bg-red-50 text-red-600 border-red-100 animate-pulse" 
          : "bg-zinc-100 text-zinc-500 border-zinc-200"
      )}>
        <MessageSquare className="h-3 w-3" />
        {count}
      </div>
    </div>
  )
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
      params={{ issueId: entry.id } as any}
      className={cn(
        'block rounded-lg border border-zinc-200 bg-white p-4 border-l-4 transition-shadow hover:shadow-sm',
        PRIORITY_BORDER[entry.priority],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full border-0 shadow-none', PRIORITY_COLORS[entry.priority])}>
              {PRIORITY_LABELS[entry.priority]}
            </Badge>
            <Badge className={cn('rounded-full border-0 shadow-none', STATUS_COLORS[entry.status])}>
              {STATUS_LABELS[entry.status]}
            </Badge>
            <Badge variant="outline" className="rounded-full text-xs font-normal text-zinc-500">
              {DEPT_LABELS[entry.department]}
            </Badge>
            {entry.assignee && (
              <Badge className="rounded-full border-0 shadow-none bg-indigo-50 text-indigo-700">
                Assigned: {getInitials(entry.assignee.full_name)}
              </Badge>
            )}
            <CommentCountBadge entryId={entry.id} />
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
          className="rounded-lg border border-zinc-200 border-l-4 border-l-zinc-200 bg-white p-4"
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
