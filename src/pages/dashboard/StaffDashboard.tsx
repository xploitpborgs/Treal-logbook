import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PlusCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { todayLabel, currentShift } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { StatsCards, StatsCardsSkeleton } from '@/components/dashboard/StatsCards'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { LogFeed } from '@/components/dashboard/LogFeed'
import { UpdateCard, type UpdateEntry } from '@/components/dashboard/UpdateCard'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_FILTERS } from '@/types/dashboard'
import type { FilterState } from '@/types/dashboard'
import type { LogEntry } from '@/types'

// ─── Schema ────────────────────────────────────────────────────────────────

const issueSchema = z.object({
  title:    z.string().min(5, 'Title must be at least 5 characters').max(150),
  category: z.string().min(1, 'Please select a category'),
  priority: z.string().min(1, 'Please select a priority'),
  body:     z.string().min(10, 'Details must be at least 10 characters'),
})
type IssueForm = z.infer<typeof issueSchema>

// ─── Query builder ─────────────────────────────────────────────────────────

function buildQuery(filters: FilterState, department: string, authorId: string | null = null) {
  const now = new Date()
  let q = supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department), assignee:profiles!assigned_to(id, full_name, avatar_url)')
    .eq('department', department)
    .order('created_at', { ascending: false })

  if (authorId) q = q.eq('author_id', authorId)

  if (filters.priority !== 'all') q = q.eq('priority', filters.priority)
  if (filters.status   !== 'all') q = q.eq('status', filters.status)
  if (filters.shift    !== 'all') q = q.eq('shift', filters.shift)
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

// ─── Log Issue Sheet ────────────────────────────────────────────────────────

interface LogIssueSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function LogIssueSheet({ open, onOpenChange, onSuccess }: LogIssueSheetProps) {
  const { profile } = useAuthContext()

  const form = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
    defaultValues: { title: '', category: '', priority: '', body: '' },
  })

  const onSubmit = async (data: IssueForm) => {
    if (!profile) return
    const { error } = await supabase.from('log_entries').insert({
      author_id:  profile.id,
      department: profile.department,
      shift:      currentShift(),
      category:   data.category,
      priority:   data.priority,
      title:      data.title.trim(),
      body:       data.body.trim(),
      status:     'open',
    })
    if (error) {
      toast.error(`Failed to log issue: ${error.message}`)
    } else {
      toast.success('Issue logged successfully')
      onOpenChange(false)
      form.reset()
      onSuccess()
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) form.reset() }}>
      <SheetContent className="flex flex-col gap-0 p-0">

        <SheetHeader className="px-6 pt-6 pb-4 border-b text-left">
          <SheetTitle>Log New Issue</SheetTitle>
          <SheetDescription>
            Report an incident, maintenance request, or handover note to your supervisor.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id="log-issue-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto px-6 py-6"
          >
            <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-5">

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief summary of the issue…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="incident">Incident</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="guest_complaint">Guest Complaint</SelectItem>
                        <SelectItem value="handover">Handover</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what happened, where, and any relevant context…"
                        className="min-h-[160px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>
          </form>
        </Form>

        <SheetFooter className="px-6 py-4 border-t gap-2 flex-row justify-end">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button
            form="log-issue-form"
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-[#C41E3A] hover:bg-[#a01830] text-white"
          >
            {form.formState.isSubmitting ? 'Submitting…' : 'Submit Issue'}
          </Button>
        </SheetFooter>

      </SheetContent>
    </Sheet>
  )
}

// ─── Staff Dashboard ────────────────────────────────────────────────────────

export function StaffDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab]   = useState('my-issues')
  const [entries, setEntries]       = useState<LogEntry[]>([])
  const [updates, setUpdates]       = useState<UpdateEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState<FilterState>(DEFAULT_FILTERS)
  const [sheetOpen, setSheetOpen]   = useState(false)

  // Tab notification state
  const [hasNewIssues, setHasNewIssues] = useState(false)
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false)

  const filtersRef = useRef(filters)
  useLayoutEffect(() => { filtersRef.current = filters })

  const fetchEntries = useCallback(async (): Promise<LogEntry[]> => {
    if (!profile) return []
    const { data, error } = await buildQuery(filtersRef.current, profile.department, profile.id)
    if (error) { toast.error(`Failed to load entries: ${error.message}`); return [] }
    return (data ?? []) as LogEntry[]
  }, [profile])

  const fetchUpdates = useCallback(async (): Promise<UpdateEntry[]> => {
    if (!profile) return []
    const [{ data: stf, error: stfErr }, { data: sup, error: supErr }] = await Promise.all([
      supabase
        .from('staff_updates')
        .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
        .or(`target_staff_id.eq.${profile.id},and(target_staff_id.is.null,department.eq.${profile.department})`)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('supervisor_updates')
        .select('*, author:profiles!author_id(id, full_name, avatar_url, department, role)')
        .or(`target_audiences.cs.{"dept:${profile.department}"}`)
        .order('created_at', { ascending: false })
        .limit(30)
    ])
    
    if (stfErr) console.error('Staff updates fetch error:', stfErr.message)
    if (supErr) console.error('Supervisor updates fetch error:', supErr.message)

    const combined = [
      ...(stf || []).map(u => ({ ...u, type: 'staff' as const })),
      ...(sup || []).map(u => ({ ...u, type: 'supervisor' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return combined as UpdateEntry[]
  }, [profile])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([fetchEntries(), fetchUpdates()]).then(([entriesData, updatesData]) => {
      if (!cancelled) {
        setEntries(entriesData)
        setUpdates(updatesData)
        setLoading(false)

        // Initial check for unseen items
        const lastSeenMyIssues = localStorage.getItem(`last_seen_staff_issues_${profile?.id}`)
        if (lastSeenMyIssues && entriesData.some(e => new Date(e.created_at).getTime() > parseInt(lastSeenMyIssues))) {
          if (activeTab !== 'my-issues') setHasNewIssues(true)
        }

        const lastSeenAnns = localStorage.getItem(`last_seen_staff_anns_${profile?.id}`)
        if (lastSeenAnns && updatesData.some(a => new Date(a.created_at).getTime() > parseInt(lastSeenAnns))) {
          if (activeTab !== 'announcements') setHasNewAnnouncements(true)
        }
      }
    })

    const channel = supabase
      .channel('log_entries_realtime_staff')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_entries' }, async () => {
        if (cancelled) return
        setEntries(await fetchEntries())
        // Even for own posts, show the indicator if we are on a different tab
        if (activeTab !== 'my-issues') setHasNewIssues(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_updates' }, async (payload) => {
        if (cancelled) return
        setUpdates(await fetchUpdates())
        const inserted = payload.new as { target_staff_id?: string, department?: string }
        if (inserted.target_staff_id === profile?.id || (!inserted.target_staff_id && inserted.department === profile?.department)) {
          if (activeTab !== 'announcements') setHasNewAnnouncements(true)
          toast.info('New announcement received')
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supervisor_updates' }, async (payload) => {
        if (cancelled) return
        setUpdates(await fetchUpdates())
        const inserted = payload.new as { target_audiences?: string[] }
        if (inserted.target_audiences?.includes(`dept:${profile?.department}`)) {
          if (activeTab !== 'announcements') setHasNewAnnouncements(true)
          toast.info('New supervisor update received')
        }
      })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [filters, fetchEntries, activeTab])

  return (
    <div className="flex flex-col gap-6">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 hidden sm:block">{todayLabel()}</p>
        <Button
          onClick={() => setSheetOpen(true)}
          className="ml-auto bg-[#C41E3A] hover:bg-[#a01830] text-white gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Log Issue
        </Button>
      </div>

      {loading ? <StatsCardsSkeleton /> : <StatsCards entries={entries} />}

      <Tabs 
        value={activeTab} 
        onValueChange={(val) => {
          setActiveTab(val)
          if (val === 'my-issues') {
            setHasNewIssues(false)
            localStorage.setItem(`last_seen_staff_issues_${profile?.id}`, Date.now().toString())
          }
          if (val === 'announcements') {
            setHasNewAnnouncements(false)
            localStorage.setItem(`last_seen_staff_anns_${profile?.id}`, Date.now().toString())
          }
        }} 
        className="w-full"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="my-issues" className="relative">
            My Issues
            {hasNewIssues && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="relative">
            Announcements
            {hasNewAnnouncements && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="mt-4 flex flex-col gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg border border-zinc-200 bg-zinc-50 animate-pulse" />
            ))
          ) : updates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <p>No announcements for you yet.</p>
            </div>
          ) : (
            updates.map(u => (
              <UpdateCard key={u.id} update={u} onMutated={fetchUpdates} />
            ))
          )}
        </TabsContent>

        <TabsContent value="my-issues" className="mt-4 flex flex-col gap-4">
          <FilterBar filters={filters} onChange={next => setFilters(prev => ({ ...prev, ...next }))} hideDepartment />
          <LogFeed entries={entries} loading={loading} />
        </TabsContent>

      </Tabs>

      <LogIssueSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => fetchEntries().then(setEntries)}
      />
    </div>
  )
}
