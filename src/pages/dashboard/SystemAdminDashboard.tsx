import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { StatsCards, StatsCardsSkeleton } from '@/components/dashboard/StatsCards'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry } from '@/types'

function buildQuery(filters: FilterState) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department)')
    .order('created_at', { ascending: false })

  if (filters.department !== 'all') q = q.eq('department', filters.department)
  if (filters.priority !== 'all') q = q.eq('priority', filters.priority)
  if (filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters.shift !== 'all') q = q.eq('shift', filters.shift)
  if (filters.category !== 'all') q = q.eq('category', filters.category)

  if (filters.dateGroup === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    q = q.gte('created_at', start.toISOString())
  } else if (filters.dateGroup === '7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    q = q.gte('created_at', start.toISOString())
  } else if (filters.dateGroup === '30days') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    q = q.gte('created_at', start.toISOString())
  }

  if (filters.search.trim()) {
    q = q.ilike('title', `%${filters.search.trim()}%`)
  }

  return q
}

export function SystemAdminDashboard() {
  const { profile } = useAuthContext()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const profileIdRef = useRef(profile?.id)
  profileIdRef.current = profile?.id

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchEntries = useCallback(async (): Promise<LogEntry[]> => {
    const { data, error } = await buildQuery(filtersRef.current)
    if (error) {
      toast.error(`Failed to load entries: ${error.message || error.details || 'Unknown error'}`)
      console.error('DashboardPage fetch error:', error)
      return []
    }
    return (data ?? []) as LogEntry[]
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchEntries().then(data => {
      if (!cancelled) {
        setEntries(data)
        setLoading(false)
      }
    })

    const channel = supabase
      .channel('log_entries_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'log_entries' },
        async payload => {
          if (cancelled) return
          const fresh = await fetchEntries()
          if (!cancelled) setEntries(fresh)

          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as { id: string; author_id: string }
            if (inserted.author_id !== profileIdRef.current) {
              const entry = fresh.find(e => e.id === inserted.id)
              toast(`New entry by ${entry?.author?.full_name ?? 'A colleague'}`)
            }
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [filters, fetchEntries])

  function updateFilters(next: Partial<FilterState>) {
    setFilters(prev => ({ ...prev, ...next }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
      </div>

      {loading ? (
        <StatsCardsSkeleton />
      ) : (
        <StatsCards entries={entries} />
      )}

      <div className="flex flex-col gap-4">
        <FilterBar filters={filters} onChange={updateFilters} />
        <LogFeed entries={entries} loading={loading} />
      </div>
    </div>
  )
}
