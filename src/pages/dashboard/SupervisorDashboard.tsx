import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { StatsCards, StatsCardsSkeleton } from '@/components/dashboard/StatsCards'
import { UpdateCard } from '@/components/dashboard/UpdateCard'
import type { UpdateEntry } from '@/components/dashboard/UpdateCard'
import { Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ClipboardList, Megaphone, Rss } from 'lucide-react'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry, GMUpdate } from '@/types'
import { FeedFilterBar, applyFeedFilters, DEFAULT_FEED_FILTERS } from '@/components/dashboard/FeedFilterBar'

function buildIssuesQuery(filters: FilterState, department: string) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role), assignee:profiles!assigned_to(id, full_name, avatar_url)')
    .or(`department.eq.${department},involved_parties.cs.{"supervisor:${department}"},involved_parties.cs.{"All Management"}`)
    .order('created_at', { ascending: false })

  if (filters.priority !== 'all') q = q.eq('priority', filters.priority)
  if (filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters.shift !== 'all') q = q.eq('shift', filters.shift)
  if (filters.category !== 'all') q = q.eq('category', filters.category)

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

export function SupervisorDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('team-issues')
  const [entries,    setEntries]    = useState<LogEntry[]>([])
  const [updates,    setUpdates]    = useState<UpdateEntry[]>([])
  const [gmUpdates,  setGMUpdates]  = useState<GMUpdate[]>([])
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS)
  const [loading,    setLoading]    = useState(true)

  // Tab notification state
  const [hasNewIssues, setHasNewIssues] = useState(false)
  const [hasNewUpdates, setHasNewUpdates] = useState(false)
  const [feedFilters, setFeedFilters] = useState(DEFAULT_FEED_FILTERS)

  const filtersRef = useRef(filters)
  useLayoutEffect(() => { filtersRef.current = filters })

  const fetchIssues = useCallback(async (): Promise<LogEntry[]> => {
    if (!profile) return []
    const { data, error } = await buildIssuesQuery(filtersRef.current, profile.department)
    if (error) { toast.error(`Failed to load issues: ${error.message}`); return [] }
    return (data ?? []) as LogEntry[]
  }, [profile])

  const fetchUpdates = useCallback(async (): Promise<UpdateEntry[]> => {
    if (!profile?.department) return []
    // Fetch HR, Supervisor, and Personal Staff updates
    const [{ data: hr }, { data: sup }, { data: stf }] = await Promise.all([
      supabase.from('hr_updates').select('*, author:profiles!author_id(*)').order('created_at', { ascending: false }).limit(20),
      supabase.from('supervisor_updates')
        .select('*, author:profiles!author_id(*)')
        .or(`team.eq.${profile.department},target_audiences.cs.{"supervisors"},target_audiences.cs.{"dept:${profile.department}"}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('staff_updates')
        .select('*, author:profiles!author_id(*)')
        .or(`target_staff_id.eq.${profile.id},and(target_staff_id.is.null,department.eq.${profile.department})`)
        .order('created_at', { ascending: false })
        .limit(20)
    ])
    
    const combined = [
      ...(hr || []).map(u => ({ ...u, type: 'hr' as const })),
      ...(sup || []).map(u => ({ ...u, type: 'supervisor' as const })),
      ...(stf || []).map(u => ({ ...u, type: 'staff' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return combined as UpdateEntry[]
  }, [profile?.department])

  // Supervisors see Global GM Directives
  const fetchGMUpdates = useCallback(async (): Promise<GMUpdate[]> => {
    const { data, error } = await supabase
      .from('gm_updates')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) return []
    return (data ?? []) as GMUpdate[]
  }, [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([fetchIssues(), fetchUpdates(), fetchGMUpdates()]).then(([issuesData, updatesData, gmData]) => {
      if (!cancelled) { 
        setEntries(issuesData)
        setUpdates(updatesData)
        setGMUpdates(gmData)
        setLoading(false) 

        // Initial check for unseen items
        const lastSeenIssues = localStorage.getItem(`last_seen_issues_${profile?.id}`)
        if (lastSeenIssues && issuesData.some(e => new Date(e.created_at).getTime() > parseInt(lastSeenIssues))) {
          if (activeTab !== 'team-issues') setHasNewIssues(true)
        }

        const lastSeenUpdates = localStorage.getItem(`last_seen_updates_${profile?.id}`)
        const allUpdates = [...updatesData, ...gmData]
        if (lastSeenUpdates && allUpdates.some(u => new Date(u.created_at).getTime() > parseInt(lastSeenUpdates))) {
          if (activeTab !== 'supervisor-feed') setHasNewUpdates(true)
        }
      }
    })

    const ch1 = supabase.channel('log_entries_realtime_supervisor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_entries' }, async () => {
        if (!cancelled) {
          setEntries(await fetchIssues())
          if (activeTab !== 'team-issues') setHasNewIssues(true)
        }
      }).subscribe()

    const ch2 = supabase.channel('updates_realtime_supervisor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (!cancelled) {
          setUpdates(await fetchUpdates())
          if (activeTab !== 'supervisor-feed') setHasNewUpdates(true)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hr_updates' }, async () => {
        if (!cancelled) {
          setUpdates(await fetchUpdates())
          if (activeTab !== 'supervisor-feed') setHasNewUpdates(true)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_updates' }, async () => {
        if (!cancelled) {
          setUpdates(await fetchUpdates())
          if (activeTab !== 'supervisor-feed') setHasNewUpdates(true)
        }
      })
      .subscribe()

    const ch3 = supabase.channel('gm_updates_realtime_supervisor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) {
          setGMUpdates(await fetchGMUpdates())
          if (activeTab !== 'supervisor-feed') setHasNewUpdates(true)
          toast.info('New GM update posted')
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) setGMUpdates(await fetchGMUpdates())
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) setGMUpdates(await fetchGMUpdates())
      }).subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3) }
  }, [filters, fetchIssues, fetchUpdates, fetchGMUpdates, activeTab])


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
        <Button asChild variant="outline" size="sm" className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
          <Link to="/announcements/new">
            <Megaphone className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Post Announcement</span>
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
          if (val === 'team-issues') {
            setHasNewIssues(false)
            localStorage.setItem(`last_seen_issues_${profile?.id}`, Date.now().toString())
          }
          if (val === 'supervisor-feed') {
            setHasNewUpdates(false)
            localStorage.setItem(`last_seen_updates_${profile?.id}`, Date.now().toString())
          }
        }}
        className="w-full"
      >
        <TabsList className="w-full justify-start rounded-none border-b border-zinc-200 bg-transparent p-0 h-auto gap-0 mb-6">
          <TabsTrigger value="team-issues" className="relative flex-none rounded-none bg-transparent border-0 border-b-2 border-b-transparent -mb-px px-4 py-2.5 h-auto text-sm font-medium text-zinc-500 hover:text-zinc-700 data-active:text-zinc-900 data-active:border-b-[#C41E3A] data-active:bg-transparent data-active:shadow-none transition-colors gap-2">
            <ClipboardList className="h-4 w-4 shrink-0" />
            Team Issues
            {hasNewIssues && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
          <TabsTrigger value="supervisor-feed" className="relative flex-none rounded-none bg-transparent border-0 border-b-2 border-b-transparent -mb-px px-4 py-2.5 h-auto text-sm font-medium text-zinc-500 hover:text-zinc-700 data-active:text-zinc-900 data-active:border-b-[#C41E3A] data-active:bg-transparent data-active:shadow-none transition-colors gap-2">
            <Rss className="h-4 w-4 shrink-0" />
            Supervisor Feed
            {hasNewUpdates && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team-issues" className="flex flex-col gap-4">
          {loading ? <StatsCardsSkeleton /> : <StatsCards entries={entries} />}
          <FilterBar filters={filters} onChange={next => setFilters(prev => ({ ...prev, ...next }))} hideDepartment />
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>

        <TabsContent value="supervisor-feed" className="flex flex-col gap-4">
          <FeedFilterBar
            filters={feedFilters}
            onChange={next => setFeedFilters(prev => ({ ...prev, ...next }))}
            availableTypes={['gm', 'hr', 'supervisor', 'staff']}
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
