import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { UpdateCard, type UpdateEntry } from '@/components/dashboard/UpdateCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ClipboardList, Megaphone, Rss } from 'lucide-react'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import { useAuthContext } from '@/lib/AuthContext'
import { FeedFilterBar, applyFeedFilters, DEFAULT_FEED_FILTERS } from '@/components/dashboard/FeedFilterBar'
import type { FeedFilters } from '@/components/dashboard/FeedFilterBar'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry } from '@/types'

export function HrDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('escalated-issues')
  const [entries,   setEntries]   = useState<LogEntry[]>([])
  const [updates,   setUpdates]   = useState<UpdateEntry[]>([])
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
      .or(`is_escalated.eq.true,involved_parties.cs.{"HR"},involved_parties.cs.{"All Management"}`)

    let supQuery = supabase
      .from('log_entries')
      .select('*, author:profiles!author_id!inner(id, full_name, avatar_url, department, role)')
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
    // HR sees HR News, ALL Supervisor Updates, and Personal messages
    const [{ data: hr }, { data: sup }, { data: stf }] = await Promise.all([
      supabase.from('hr_updates').select('*, author:profiles!author_id(*)').order('created_at', { ascending: false }).limit(20),
      supabase.from('supervisor_updates')
        .select('*, author:profiles!author_id(*)')
        .or(`target_audiences.cs.{"hr"},target_audiences.is.null,target_audiences.eq.'{}'`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('staff_updates')
        .select('*, author:profiles!author_id(*)')
        .or(`author_id.eq.${profile?.id},target_staff_id.eq.${profile?.id}`)
        .order('created_at', { ascending: false })
        .limit(20)
    ])
    
    const combined = [
      ...(hr || []).map(u => ({ ...u, type: 'hr' as const })),
      ...(sup || []).map(u => ({ ...u, type: 'supervisor' as const })),
      ...(stf || []).map(u => ({ ...u, type: 'staff' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return combined as UpdateEntry[]
  }, [profile?.id])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    Promise.all([fetchIssues(), fetchUpdates()]).then(([issuesData, updatesData]) => {
      if (!cancelled) {
        setEntries(issuesData)
        setUpdates(updatesData)
        setLoading(false)

        const lastSeenEscalated = localStorage.getItem(`last_seen_hr_issues_${profile?.id}`)
        if (lastSeenEscalated && issuesData.some(e => new Date(e.created_at).getTime() > parseInt(lastSeenEscalated))) {
          if (activeTab !== 'escalated-issues') setHasNewIssues(true)
        }

        const lastSeenUpdates = localStorage.getItem(`last_seen_hr_updates_${profile?.id}`)
        if (lastSeenUpdates && updatesData.some(u => new Date(u.created_at).getTime() > parseInt(lastSeenUpdates))) {
          if (activeTab !== 'feed') setHasNewUpdates(true)
        }
      }
    })

    const channel = supabase
      .channel('updates_realtime_hr')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (cancelled) return
        setUpdates(await fetchUpdates())
        if (activeTab !== 'feed') setHasNewUpdates(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hr_updates' }, async () => {
        if (cancelled) return
        setUpdates(await fetchUpdates())
        if (activeTab !== 'feed') setHasNewUpdates(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_updates' }, async () => {
        if (cancelled) return
        setUpdates(await fetchUpdates())
        if (activeTab !== 'feed') setHasNewUpdates(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_entries' }, async () => {
        if (cancelled) return
        setEntries(await fetchIssues())
        if (activeTab !== 'escalated-issues') setHasNewIssues(true)
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [fetchIssues, fetchUpdates, activeTab, filters, profile?.id])


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
        <Button asChild variant="outline" size="sm" className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
          <Link to="/announcements/new">
            <Megaphone className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Post HR Update</span>
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
          if (val === 'escalated-issues') {
            setHasNewIssues(false)
            localStorage.setItem(`last_seen_hr_issues_${profile?.id}`, Date.now().toString())
          }
          if (val === 'feed') {
            setHasNewUpdates(false)
            localStorage.setItem(`last_seen_hr_updates_${profile?.id}`, Date.now().toString())
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
          <TabsTrigger value="feed" className="relative flex-none rounded-none bg-transparent border-0 border-b-2 border-b-transparent -mb-px px-4 py-2.5 h-auto text-sm font-medium text-zinc-500 hover:text-zinc-700 data-active:text-zinc-900 data-active:border-b-[#C41E3A] data-active:bg-transparent data-active:shadow-none transition-colors gap-2">
            <Rss className="h-4 w-4 shrink-0" />
            HR Feed
            {hasNewUpdates && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escalated-issues" className="flex flex-col gap-4">
          <FilterBar filters={filters} onChange={next => setFilters(prev => ({ ...prev, ...next }))} />
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>

        <TabsContent value="feed" className="flex flex-col gap-4">
          <FeedFilterBar
            filters={feedFilters}
            onChange={next => setFeedFilters(prev => ({ ...prev, ...next }))}
            availableTypes={['hr', 'supervisor', 'staff']}
          />
          {loading ? (
            <div className="text-sm text-zinc-500">Loading updates...</div>
          ) : (() => {
            const visible = applyFeedFilters(updates, feedFilters)
            if (visible.length === 0) return (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
                <p className="text-sm font-medium text-zinc-500">No updates match your filters</p>
              </div>
            )
            return (
              <div className="flex flex-col gap-4">
                {visible.map(u => (
                  <UpdateCard key={u.id} update={u} onMutated={async () => setUpdates(await fetchUpdates())} />
                ))}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
