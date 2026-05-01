import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { detectShift } from '@/lib/formatters'
import { useAuthContext } from '@/lib/AuthContext'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { StatsCards, StatsCardsSkeleton } from '@/components/dashboard/StatsCards'
import { UpdateCard } from '@/components/dashboard/UpdateCard'
import type { UpdateEntry } from '@/components/dashboard/UpdateCard'
import { GMUpdateCard } from '@/components/dashboard/GMUpdateCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry, GMUpdate } from '@/types'

function buildIssuesQuery(filters: FilterState, department: string) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
    .eq('department', department)
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
  const [loading,    setLoading]    = useState(true)
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS)
  const [updateBody, setUpdateBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchIssues = useCallback(async (): Promise<LogEntry[]> => {
    if (!profile) return []
    const { data, error } = await buildIssuesQuery(filtersRef.current, profile.department)
    if (error) { toast.error(`Failed to load issues: ${error.message}`); return [] }
    return (data ?? []) as LogEntry[]
  }, [profile])

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
      .order('created_at', { ascending: false }).limit(50)
    if (error) { console.error('GM updates fetch error:', error.message); return [] }
    return (data ?? []) as GMUpdate[]
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchIssues(), fetchUpdates(), fetchGMUpdates()]).then(([issuesData, updatesData, gmData]) => {
      if (!cancelled) { setEntries(issuesData); setUpdates(updatesData); setGMUpdates(gmData); setLoading(false) }
    })

    const ch1 = supabase.channel('log_entries_realtime_supervisor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_entries' }, async () => {
        if (!cancelled && activeTab === 'team-issues') setEntries(await fetchIssues())
      }).subscribe()

    const ch2 = supabase.channel('updates_realtime_supervisor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (!cancelled) setUpdates(await fetchUpdates())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_updates' }, async () => {
        if (!cancelled) setUpdates(await fetchUpdates())
      }).subscribe()

    const ch3 = supabase.channel('gm_updates_realtime_supervisor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gm_updates' }, async () => {
        if (!cancelled) {
          setGMUpdates(await fetchGMUpdates())
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

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !updateBody.trim()) { toast.error('Message is required'); return }
    setSubmitting(true)
    const { error } = await supabase.from('supervisor_updates').insert({
      author_id: profile.id,
      department: profile.department,
      shift: detectShift(),
      body: updateBody.trim(),
    })
    setSubmitting(false)
    if (error) {
      toast.error(`Failed to post: ${error.message}`)
    } else {
      toast.success('Supervisor Update posted')
      setUpdateBody('')
      setActiveTab('supervisor-feed')
      setUpdates(await fetchUpdates())
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:flex items-center justify-between">
        <p className="text-sm text-zinc-500">{todayLabel()}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="team-issues">Team Issues</TabsTrigger>
          <TabsTrigger value="supervisor-feed">Supervisor Feed</TabsTrigger>
          <TabsTrigger value="post">Post Update</TabsTrigger>
        </TabsList>

        <TabsContent value="team-issues" className="mt-4 flex flex-col gap-4">
          {loading ? <StatsCardsSkeleton /> : <StatsCards entries={entries} />}
          <FilterBar filters={filters} onChange={next => setFilters(prev => ({ ...prev, ...next }))} hideDepartment />
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>

        <TabsContent value="supervisor-feed" className="mt-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading updates...</div>
          ) : updates.length === 0 && gmUpdates.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200">
              <p className="text-sm font-medium text-zinc-500">No updates yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* GM Directives section */}
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

        <TabsContent value="post" className="mt-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Post a new Supervisor Update</h2>
            <form onSubmit={handlePostUpdate} className="flex flex-col gap-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Message</label>
                <Textarea
                  placeholder="Share cross-team updates or announcements..."
                  className="min-h-[120px]"
                  value={updateBody}
                  onChange={e => setUpdateBody(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#a31e22] hover:bg-[#8a181c] text-white"
                disabled={submitting}
              >
                {submitting ? 'Posting...' : 'Post Update'}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
