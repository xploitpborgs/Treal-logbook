import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel, timeAgo } from '@/lib/format'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry, SupervisorUpdate, HrUpdate } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

type CombinedUpdate = (SupervisorUpdate & { type: 'supervisor' }) | (HrUpdate & { type: 'hr' })

function buildIssuesQuery(filters: FilterState) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
    .eq('status', 'escalated') // strictly only escalated issues
    .order('created_at', { ascending: false })

  if (filters.department !== 'all') q = q.eq('department', filters.department)
  if (filters.priority !== 'all') q = q.eq('priority', filters.priority)
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

export function GMDashboard() {
  const [activeTab, setActiveTab] = useState('escalated-issues')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [updates, setUpdates] = useState<CombinedUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchIssues = useCallback(async (): Promise<LogEntry[]> => {
    const { data, error } = await buildIssuesQuery(filtersRef.current)
    if (error) {
      toast.error(`Failed to load escalated issues: ${error.message}`)
      return []
    }
    return (data ?? []) as LogEntry[]
  }, [])

  const fetchUpdates = useCallback(async (): Promise<CombinedUpdate[]> => {
    const supRes = await supabase
      .from('supervisor_updates')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
      .order('created_at', { ascending: false })
      .limit(50)
      
    const hrRes = await supabase
      .from('hr_updates')
      .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
      .order('created_at', { ascending: false })
      .limit(50)

    const supData = (supRes.data ?? []).map((u: any) => ({ ...u, type: 'supervisor' as const }))
    const hrData = (hrRes.data ?? []).map((u: any) => ({ ...u, type: 'hr' as const }))

    const combined = [...supData, ...hrData].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return combined
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([fetchIssues(), fetchUpdates()]).then(([issuesData, updatesData]) => {
      if (!cancelled) {
        setEntries(issuesData)
        setUpdates(updatesData)
        setLoading(false)
      }
    })

    const channel1 = supabase
      .channel('log_entries_realtime_gm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_entries' }, async () => {
        if (cancelled) return
        if (activeTab === 'escalated-issues') setEntries(await fetchIssues())
      }).subscribe()

    const channel2 = supabase
      .channel('updates_realtime_gm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (cancelled) return
        if (activeTab === 'supervisor-feed') setUpdates(await fetchUpdates())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_updates' }, async () => {
        if (cancelled) return
        if (activeTab === 'supervisor-feed') setUpdates(await fetchUpdates())
      }).subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel1)
      supabase.removeChannel(channel2)
    }
  }, [filters, fetchIssues, fetchUpdates, activeTab])

  function updateFilters(next: Partial<FilterState>) {
    setFilters(prev => ({ ...prev, ...next }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="escalated-issues">Escalated Issues</TabsTrigger>
          <TabsTrigger value="supervisor-feed">Updates Feed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="escalated-issues" className="mt-4 flex flex-col gap-4">
          {/* GM can filter by department, but status is fixed to escalated so hide status? 
              FilterBar doesn't have hideStatus yet, we just let it be. If they change status to "open",
              our buildQuery overrides it by hardcoding .eq('status', 'escalated'). We should update buildQuery to ignore filters.status. Wait, I didn't include filters.status in buildIssuesQuery! Correct. */}
          <FilterBar filters={filters} onChange={updateFilters} />
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>
        
        <TabsContent value="supervisor-feed" className="mt-4">
          {loading ? (
             <div className="text-sm text-zinc-500">Loading updates...</div>
          ) : updates.length === 0 ? (
             <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
               <p className="text-sm font-medium text-zinc-500">No updates yet</p>
             </div>
          ) : (
            <div className="flex flex-col gap-4">
              {updates.map(u => (
                <div key={u.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={u.author?.avatar_url || ''} />
                      <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-600">
                        {getInitials(u.author?.full_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">
                        {u.author?.full_name || 'Unknown'} 
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          {u.type === 'hr' ? 'HR Update' : 'Supervisor Update'}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">{timeAgo(u.created_at)}</p>
                    </div>
                  </div>
                  {u.type === 'hr' && u.title && (
                    <h3 className="mt-3 text-sm font-semibold text-zinc-900">{u.title}</h3>
                  )}
                  <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{u.body}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
