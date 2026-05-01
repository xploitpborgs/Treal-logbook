import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { UpdateCard } from '@/components/dashboard/UpdateCard'
import type { UpdateEntry } from '@/components/dashboard/UpdateCard'
import { GMUpdateCard } from '@/components/dashboard/GMUpdateCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry, GMUpdate } from '@/types'
import { Download, Megaphone } from 'lucide-react'
import { useAuthContext } from '@/lib/AuthContext'

function buildIssuesQuery(filters: FilterState) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
    .eq('is_escalated', true)
    .order('created_at', { ascending: false })

  if (filters.department !== 'all') q = q.eq('department', filters.department)
  if (filters.priority !== 'all')   q = q.eq('priority', filters.priority)
  if (filters.shift !== 'all')      q = q.eq('shift', filters.shift)
  if (filters.category !== 'all')   q = q.eq('category', filters.category)

  if (filters.dateGroup === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    q = q.gte('created_at', start.toISOString())
  } else if (filters.dateGroup === '7days') {
    q = q.gte('created_at', new Date(now.getTime() - 7 * 864e5).toISOString())
  } else if (filters.dateGroup === '30days') {
    q = q.gte('created_at', new Date(now.getTime() - 30 * 864e5).toISOString())
  }

  if (filters.search.trim()) q = q.ilike('title', `%${filters.search.trim()}%`)
  return q
}

function exportToCSV(entries: LogEntry[]) {
  const headers = ['Date', 'Title', 'Department', 'Priority', 'Status', 'Category', 'Shift', 'Author', 'Body']
  const rows = entries.map(e => [
    new Date(e.created_at).toLocaleDateString('en-GB'),
    `"${(e.title ?? '').replace(/"/g, '""')}"`,
    e.department, e.priority, e.status, e.category, e.shift,
    `"${(e.author?.full_name ?? 'Unknown').replace(/"/g, '""')}"`,
    `"${(e.body ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
  ])
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `escalated-issues-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
  toast.success('Report downloaded')
}

// ─── Merged feed type ────────────────────────────────────────────────────────

type FeedItem =
  | (UpdateEntry & { feedType: 'update' })
  | (GMUpdate    & { feedType: 'gm'; type: 'gm' })

export function GMDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('escalated-issues')
  const [entries,   setEntries]   = useState<LogEntry[]>([])
  const [updates,   setUpdates]   = useState<UpdateEntry[]>([])
  const [gmUpdates, setGMUpdates] = useState<GMUpdate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filters,   setFilters]   = useState<FilterState>(DEFAULT_FILTERS)

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchIssues = useCallback(async (): Promise<LogEntry[]> => {
    const { data, error } = await buildIssuesQuery(filtersRef.current)
    if (error) { toast.error(`Failed to load escalated issues: ${error.message}`); return [] }
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
    const hrData  = (hrRes.data  ?? []).map((u: any) => ({ ...u, type: 'hr'         as const }))
    return [...supData, ...hrData].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [])

  const fetchGMUpdates = useCallback(async (): Promise<GMUpdate[]> => {
    const { data, error } = await supabase
      .from('gm_updates')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
      .eq('author_id', profile?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { console.error('GM updates fetch error:', error.message); return [] }
    return (data ?? []) as GMUpdate[]
  }, [profile?.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchIssues(), fetchUpdates(), fetchGMUpdates()]).then(([issues, upd, gm]) => {
      if (!cancelled) { setEntries(issues); setUpdates(upd); setGMUpdates(gm); setLoading(false) }
    })

    const ch1 = supabase.channel('log_entries_realtime_gm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_entries' }, async () => {
        if (!cancelled && activeTab === 'escalated-issues') setEntries(await fetchIssues())
      }).subscribe()

    const ch2 = supabase.channel('updates_realtime_gm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (!cancelled) setUpdates(await fetchUpdates())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_updates' }, async () => {
        if (!cancelled) setUpdates(await fetchUpdates())
      }).subscribe()

    const ch3 = supabase.channel('gm_updates_realtime_gm')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gm_updates' }, async (payload) => {
        if (!cancelled) {
          const fresh = await fetchGMUpdates()
          setGMUpdates(fresh)
          const inserted = payload.new as { author_id?: string }
          if (inserted.author_id !== profile?.id) {
            toast.info('New GM update posted')
          }
        }
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
  }, [filters, fetchIssues, fetchUpdates, fetchGMUpdates, activeTab, profile?.id])

  // Build interleaved feed: supervisor + hr updates + own gm updates, sorted by date
  const feedItems: FeedItem[] = [
    ...updates.map(u => ({ ...u, feedType: 'update' as const })),
    ...gmUpdates.map(g => ({ ...g, feedType: 'gm' as const, type: 'gm' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
        <Button asChild variant="outline" size="sm" className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
          <Link to="/gm-update/new">
            <Megaphone className="h-4 w-4" />
            Post GM Update
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="escalated-issues">Escalated Issues</TabsTrigger>
          <TabsTrigger value="updates-feed">Updates Feed</TabsTrigger>
        </TabsList>

        {/* ── Escalated Issues ── */}
        <TabsContent value="escalated-issues" className="mt-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1">
              <FilterBar filters={filters} onChange={next => setFilters(prev => ({ ...prev, ...next }))} />
            </div>
            <Button
              variant="outline" size="sm"
              className="gap-2 shrink-0 border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              disabled={loading || entries.length === 0}
              onClick={() => exportToCSV(entries)}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>

        {/* ── Updates Feed ── */}
        <TabsContent value="updates-feed" className="mt-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading updates...</div>
          ) : feedItems.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
              <p className="text-sm font-medium text-zinc-500">No updates yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {feedItems.map(item => {
                if (item.feedType === 'gm') {
                  return (
                    <GMUpdateCard
                      key={`gm-${item.id}`}
                      update={item as GMUpdate}
                    />
                  )
                }
                return (
                  <UpdateCard
                    key={item.id}
                    update={item as UpdateEntry}
                    onMutated={async () => setUpdates(await fetchUpdates())}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
