import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { StatsCards, StatsCardsSkeleton } from '@/components/dashboard/StatsCards'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { UpdateCard } from '@/components/dashboard/UpdateCard'
import type { UpdateEntry } from '@/components/dashboard/UpdateCard'
import { GMUpdateCard } from '@/components/dashboard/GMUpdateCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry, GMUpdate } from '@/types'
import { Megaphone } from 'lucide-react'

function buildQuery(filters: FilterState) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department), assignee:profiles!assigned_to(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })

  if (filters.department !== 'all') q = q.eq('department', filters.department)
  if (filters.priority !== 'all')   q = q.eq('priority', filters.priority)
  if (filters.status !== 'all')     q = q.eq('status', filters.status)
  if (filters.shift !== 'all')      q = q.eq('shift', filters.shift)
  if (filters.category !== 'all')   q = q.eq('category', filters.category)

  if (filters.dateGroup === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    q = q.gte('created_at', start.toISOString())
  } else if (filters.dateGroup === '7days') {
    q = q.gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
  } else if (filters.dateGroup === '30days') {
    q = q.gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
  }

  if (filters.search.trim()) q = q.ilike('title', `%${filters.search.trim()}%`)
  return q
}

export function SystemAdminDashboard() {
  const { profile } = useAuthContext()
  const [activeTab,  setActiveTab]  = useState('issues')
  const [entries,    setEntries]    = useState<LogEntry[]>([])
  const [updates,    setUpdates]    = useState<UpdateEntry[]>([])
  const [gmUpdates,  setGMUpdates]  = useState<GMUpdate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS)

  const profileIdRef = useRef(profile?.id)
  profileIdRef.current = profile?.id

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchEntries = useCallback(async (): Promise<LogEntry[]> => {
    const { data, error } = await buildQuery(filtersRef.current)
    if (error) { toast.error(`Failed to load entries: ${error.message}`); return [] }
    return (data ?? []) as LogEntry[]
  }, [])

  const fetchUpdates = useCallback(async (): Promise<UpdateEntry[]> => {
    const [supRes, hrRes] = await Promise.all([
      supabase.from('supervisor_updates')
        .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('hr_updates')
        .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
        .order('created_at', { ascending: false }).limit(50),
    ])
    const supData = (supRes.data ?? []).map((u: any) => ({ ...u, type: 'supervisor' as const }))
    const hrData  = (hrRes.data  ?? []).map((u: any) => ({ ...u, type: 'hr' as const }))
    return [...supData, ...hrData].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [])

  const fetchGMUpdates = useCallback(async (): Promise<GMUpdate[]> => {
    const { data, error } = await supabase
      .from('gm_updates')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
      .order('created_at', { ascending: false })
    if (error) { console.error('GM updates fetch error:', error.message); return [] }
    return (data ?? []) as GMUpdate[]
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([fetchEntries(), fetchUpdates(), fetchGMUpdates()]).then(([e, u, gm]) => {
      if (!cancelled) { setEntries(e); setUpdates(u); setGMUpdates(gm); setLoading(false) }
    })

    const ch1 = supabase.channel('log_entries_realtime_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_entries' }, async (payload) => {
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
      }).subscribe()

    const ch2 = supabase.channel('updates_realtime_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (!cancelled) setUpdates(await fetchUpdates())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_updates' }, async () => {
        if (!cancelled) setUpdates(await fetchUpdates())
      }).subscribe()

    const ch3 = supabase.channel('gm_updates_realtime_admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) { setGMUpdates(await fetchGMUpdates()); toast.info('New GM update posted') }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) setGMUpdates(await fetchGMUpdates())
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) setGMUpdates(await fetchGMUpdates())
      }).subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
    }
  }, [filters, fetchEntries, fetchUpdates, fetchGMUpdates])

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
      </div>

      {loading ? <StatsCardsSkeleton /> : <StatsCards entries={entries} />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="issues">All Issues</TabsTrigger>
          <TabsTrigger value="management-feed">Management Feed</TabsTrigger>
          <TabsTrigger value="gm-updates">GM Updates</TabsTrigger>
        </TabsList>

        {/* ── All Issues ── */}
        <TabsContent value="issues" className="mt-4 flex flex-col gap-4">
          <FilterBar filters={filters} onChange={next => setFilters(prev => ({ ...prev, ...next }))} />
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>

        {/* ── Management Feed — all update types interleaved ── */}
        <TabsContent value="management-feed" className="mt-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading updates...</div>
          ) : updates.length === 0 && gmUpdates.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
              <p className="text-sm font-medium text-zinc-500">No updates yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* GM Directives pinned at top */}
              {gmUpdates.length > 0 && (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-600 py-1">GM Directives</p>
                  {gmUpdates.map(g => (
                    <GMUpdateCard key={g.id} update={g} />
                  ))}
                  {updates.length > 0 && <div className="border-t border-zinc-100 my-1" />}
                </>
              )}
              {/* Supervisor + HR updates */}
              {updates.map(u => (
                <UpdateCard key={u.id} update={u} onMutated={async () => setUpdates(await fetchUpdates())} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── GM Updates standalone tab ── */}
        <TabsContent value="gm-updates" className="mt-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading GM updates...</div>
          ) : gmUpdates.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-200">
              <Megaphone className="h-8 w-8 text-zinc-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-500">No GM updates yet</p>
                <p className="text-xs text-zinc-400 mt-1">GM updates will appear here when posted</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {gmUpdates.map(g => (
                <GMUpdateCard key={g.id} update={g} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
