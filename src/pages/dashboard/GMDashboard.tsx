import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { UpdateCard } from '@/components/dashboard/UpdateCard'
import type { UpdateEntry } from '@/components/dashboard/UpdateCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry, GMUpdate } from '@/types'
import { ClipboardList, Download, Megaphone, Rss } from 'lucide-react'
import { useAuthContext } from '@/lib/AuthContext'
import { FeedFilterBar, applyFeedFilters, DEFAULT_FEED_FILTERS } from '@/components/dashboard/FeedFilterBar'
import type { FeedFilters } from '@/components/dashboard/FeedFilterBar'



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

export function GMDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('escalated-issues')
  const [entries,   setEntries]   = useState<LogEntry[]>([])
  const [updates,   setUpdates]   = useState<UpdateEntry[]>([])
  const [gmUpdates, setGMUpdates] = useState<GMUpdate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filters,   setFilters]   = useState<FilterState>(DEFAULT_FILTERS)

  // Tab notification state
  const [hasNewIssues, setHasNewIssues] = useState(false)
  const [hasNewUpdates, setHasNewUpdates] = useState(false)
  const [feedFilters, setFeedFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS)

  const filtersRef = useRef(filters)
  useLayoutEffect(() => { filtersRef.current = filters })

  const fetchIssues = useCallback(async (): Promise<LogEntry[]> => {
    const f = filtersRef.current
    
    // Base builders
    let escQuery = supabase
      .from('log_entries')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role), assignee:profiles!assigned_to(id, full_name, avatar_url)')
      .eq('is_escalated', true)

    let supQuery = supabase
      .from('log_entries')
      .select('*, author:profiles!author_id!inner(id, full_name, avatar_url, department, role), assignee:profiles!assigned_to(id, full_name, avatar_url)')
      .eq('author.role', 'supervisor')

    // Apply Filters to both
    const applyCommonFilters = (q: any) => {
      const now = new Date()
      if (f.department !== 'all') q = q.eq('department', f.department)
      if (f.priority !== 'all')   q = q.eq('priority', f.priority)
      if (f.shift !== 'all')      q = q.eq('shift', f.shift)
      if (f.category !== 'all')   q = q.eq('category', f.category)
      if (f.status !== 'all')     q = q.eq('status', f.status)
      if (f.search.trim())        q = q.ilike('title', `%${f.search.trim()}%`)

      if (f.dateGroup === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0)
        q = q.gte('created_at', start.toISOString())
      } else if (f.dateGroup === '7days') {
        q = q.gte('created_at', new Date(now.getTime() - 7 * 864e5).toISOString())
      } else if (f.dateGroup === '30days') {
        q = q.gte('created_at', new Date(now.getTime() - 30 * 864e5).toISOString())
      }

      return q.order('created_at', { ascending: false }).limit(50)
    }

    escQuery = applyCommonFilters(escQuery)
    supQuery = applyCommonFilters(supQuery)

    const [escResponse, supResponse] = await Promise.all([escQuery, supQuery])

    const combined = [
      ...((escResponse.data as any) || []),
      ...((supResponse.data as any) || [])
    ]

    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values())
    return (unique as LogEntry[]).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [])

  const fetchUpdates = useCallback(async (): Promise<UpdateEntry[]> => {
    if (!profile) return []
    // GM sees updates targeted at them or all supervisors, plus legacy updates
    const { data: sup } = await supabase.from('supervisor_updates')
      .select('*, author:profiles!author_id(*)')
      .or(`target_audiences.cs.{"gm"},target_audiences.is.null,target_audiences.eq.'{}'`)
      .order('created_at', { ascending: false })
      .limit(50)
    // GM sees personal messages to/from them
    const { data: stf } = await supabase.from('staff_updates')
      .select('*, author:profiles!author_id(*), target_staff:profiles!target_staff_id(*)')
      .or(`author_id.eq.${profile.id},target_staff_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(50)
    
    const combined = [
      ...(sup || []).map(s => ({ ...s, type: 'supervisor' as const })),
      ...(stf || []).map(s => ({ ...s, type: 'staff' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return combined as UpdateEntry[]
  }, [profile])

  const fetchGMUpdates = useCallback(async (): Promise<GMUpdate[]> => {
    const { data, error } = await supabase
      .from('gm_updates')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { console.error('GM updates fetch error:', error.message); return [] }
    return (data ?? []) as GMUpdate[]
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchIssues(), fetchUpdates(), fetchGMUpdates()]).then(([issuesData, updatesData, gmData]) => {
      if (!cancelled) { 
        setEntries(issuesData)
        setUpdates(updatesData)
        setGMUpdates(gmData)
        setLoading(false) 

        // Initial check for unseen items
        const lastSeenEscalated = localStorage.getItem(`last_seen_escalated_${profile?.id}`)
        if (lastSeenEscalated && issuesData.some(e => new Date(e.created_at).getTime() > parseInt(lastSeenEscalated))) {
          if (activeTab !== 'escalated-issues') setHasNewIssues(true)
        }

        const lastSeenUpdates = localStorage.getItem(`last_seen_gm_updates_${profile?.id}`)
        const allUpdates = [...updatesData, ...gmData]
        if (lastSeenUpdates && allUpdates.some(u => new Date(u.created_at).getTime() > parseInt(lastSeenUpdates))) {
          if (activeTab !== 'gm-feed') setHasNewUpdates(true)
        }
      }
    })

    const ch1 = supabase.channel('log_entries_realtime_gm')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_entries' }, async () => {
        if (!cancelled) {
          setEntries(await fetchIssues())
          if (activeTab !== 'escalated-issues') setHasNewIssues(true)
        }
      }).subscribe()

    const ch2 = supabase.channel('updates_realtime_gm')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (!cancelled) {
          setUpdates(await fetchUpdates())
          if (activeTab !== 'gm-feed') setHasNewUpdates(true)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hr_updates' }, async () => {
        if (!cancelled) {
          setUpdates(await fetchUpdates())
          if (activeTab !== 'gm-feed') setHasNewUpdates(true)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_updates' }, async () => {
        if (!cancelled) {
          setUpdates(await fetchUpdates())
          if (activeTab !== 'gm-feed') setHasNewUpdates(true)
        }
      })
      .subscribe()

    const ch3 = supabase.channel('gm_updates_realtime_gm')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gm_updates' }, async (payload) => {
        if (!cancelled) {
          const fresh = await fetchGMUpdates()
          setGMUpdates(fresh)
          const inserted = payload.new as { author_id?: string }
          if (inserted.author_id !== profile?.id) {
            if (activeTab !== 'gm-feed') setHasNewUpdates(true)
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
        <Button asChild variant="outline" size="sm" className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
          <Link to="/announcements/new">
            <Megaphone className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Post GM Update</span>
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
          if (val === 'escalated-issues') {
            setHasNewIssues(false)
            localStorage.setItem(`last_seen_escalated_${profile?.id}`, Date.now().toString())
          }
          if (val === 'gm-feed') {
            setHasNewUpdates(false)
            localStorage.setItem(`last_seen_gm_updates_${profile?.id}`, Date.now().toString())
          }
        }}
        className="w-full"
      >
        <TabsList className="w-full justify-start rounded-none border-b border-zinc-200 bg-transparent p-0 h-auto gap-0 mb-6">
          <TabsTrigger value="escalated-issues" className="relative flex-none rounded-none bg-transparent border-0 border-b-2 border-b-transparent -mb-px px-4 py-2.5 h-auto text-sm font-medium text-zinc-500 hover:text-zinc-700 data-active:text-zinc-900 data-active:border-b-[#C41E3A] data-active:bg-transparent data-active:shadow-none transition-colors gap-2">
            <ClipboardList className="h-4 w-4 shrink-0" />
            Escalated Issues
            {hasNewIssues && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
          <TabsTrigger value="gm-feed" className="relative flex-none rounded-none bg-transparent border-0 border-b-2 border-b-transparent -mb-px px-4 py-2.5 h-auto text-sm font-medium text-zinc-500 hover:text-zinc-700 data-active:text-zinc-900 data-active:border-b-[#C41E3A] data-active:bg-transparent data-active:shadow-none transition-colors gap-2">
            <Rss className="h-4 w-4 shrink-0" />
            GM Feed
            {hasNewUpdates && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Escalated Issues ── */}
        <TabsContent value="escalated-issues" className="flex flex-col gap-4">
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

        {/* ── GM Feed ── */}
        <TabsContent value="gm-feed" className="flex flex-col gap-4">
          <FeedFilterBar
            filters={feedFilters}
            onChange={next => setFeedFilters(prev => ({ ...prev, ...next }))}
            availableTypes={['gm', 'supervisor', 'staff']}
          />
          {loading ? (
            <div className="text-sm text-zinc-500">Loading updates...</div>
          ) : (() => {
            const allItems = [
              ...gmUpdates.map(g => ({ ...g, type: 'gm' as const })),
              ...updates,
            ]
            const visible = applyFeedFilters(allItems, feedFilters)
            const visibleGM = visible.filter(i => i.type === 'gm')
            const visibleOther = visible.filter(i => i.type !== 'gm')
            if (visible.length === 0) return (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
                <p className="text-sm font-medium text-zinc-500">No updates match your filters</p>
              </div>
            )
            return (
              <div className="flex flex-col gap-4">
                {visibleGM.length > 0 && (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-600 py-1">GM Directives</p>
                    {visibleGM.map(g => (
                      <UpdateCard key={`gm-${g.id}`} update={g as any} onMutated={async () => setGMUpdates(await fetchGMUpdates())} />
                    ))}
                    {visibleOther.length > 0 && <div className="border-t border-zinc-100 my-1" />}
                  </>
                )}
                {visibleOther.map(u => (
                  <UpdateCard key={u.id} update={u as any} onMutated={async () => setUpdates(await fetchUpdates())} />
                ))}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
