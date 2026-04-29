import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { StatsCards, StatsCardsSkeleton } from '@/components/dashboard/StatsCards'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry } from '@/types'

function buildQuery(filters: FilterState, department: string, authorId: string | null = null) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department)')
    .eq('department', department)
    .order('created_at', { ascending: false })

  if (authorId) {
    q = q.eq('author_id', authorId)
  } else {
    // For Team Issues, we exclude the user's own issues
    // Wait, the user might want to see all team issues together? 
    // The spec said "My Issues" and "Team Issues". Let's show all team issues in Team Issues,
    // or exclude their own. Exclude their own to avoid duplicates.
    // q = q.neq('author_id', authorId) // Wait, maybe it's better to just show all in team issues.
  }

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

export function StaffDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('my-issues')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const profileIdRef = useRef(profile?.id)
  profileIdRef.current = profile?.id

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetchEntries = useCallback(async (): Promise<LogEntry[]> => {
    if (!profile) return []
    const authorFilter = activeTab === 'my-issues' ? profile.id : null
    const { data, error } = await buildQuery(filtersRef.current, profile.department, authorFilter)
    
    if (error) {
      toast.error(`Failed to load entries: ${error.message}`)
      return []
    }
    
    // For Team Issues, filter out the current user's issues on the client side
    // if we want strict separation. Let's do that for clarity.
    let result = (data ?? []) as LogEntry[]
    if (activeTab === 'team-issues') {
      result = result.filter(e => e.author_id !== profile.id)
    }
    
    return result
  }, [profile, activeTab])

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
      .channel('log_entries_realtime_staff')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'log_entries' },
        async () => {
          if (cancelled) return
          const fresh = await fetchEntries()
          if (!cancelled) setEntries(fresh)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [filters, fetchEntries, activeTab])

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="my-issues">My Issues</TabsTrigger>
          <TabsTrigger value="team-issues">Team Issues</TabsTrigger>
        </TabsList>
        
        <FilterBar filters={filters} onChange={updateFilters} hideDepartment />
        
        <TabsContent value="my-issues" className="mt-4">
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>
        <TabsContent value="team-issues" className="mt-4">
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
