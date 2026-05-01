import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { UpdateCard } from '@/components/dashboard/UpdateCard'
import type { UpdateEntry } from '@/components/dashboard/UpdateCard'
import { GMUpdateCard } from '@/components/dashboard/GMUpdateCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { GMUpdate } from '@/types'

export function HrDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('feed')
  const [updates,   setUpdates]   = useState<UpdateEntry[]>([])
  const [gmUpdates, setGMUpdates] = useState<GMUpdate[]>([])
  const [loading,   setLoading]   = useState(true)

  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

    fetchUpdates().then(data => {
      if (!cancelled) { setUpdates(data); setLoading(false) }
    })
    fetchGMUpdates().then(data => {
      if (!cancelled) setGMUpdates(data)
    })

    const channel = supabase
      .channel('updates_realtime_hr')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisor_updates' }, async () => {
        if (cancelled) return
        if (activeTab === 'feed') setUpdates(await fetchUpdates())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_updates' }, async () => {
        if (cancelled) return
        if (activeTab === 'feed') setUpdates(await fetchUpdates())
      }).subscribe()

    const chGM = supabase.channel('gm_updates_realtime_hr')
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
      supabase.removeChannel(channel)
      supabase.removeChannel(chGM)
    }
  }, [fetchUpdates, fetchGMUpdates, activeTab])

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('hr_updates').insert({
      author_id: profile.id,
      title: title.trim(),
      body: body.trim(),
    })

    setSubmitting(false)

    if (error) {
      toast.error(`Failed to post update: ${error.message}`)
    } else {
      toast.success('HR Update posted successfully')
      setTitle('')
      setBody('')
      setActiveTab('feed')
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
          <TabsTrigger value="feed">Updates Feed</TabsTrigger>
          <TabsTrigger value="post">Post HR Update</TabsTrigger>
        </TabsList>
        
        <TabsContent value="feed" className="mt-4">
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
              {updates.map(u => (
                <UpdateCard key={u.id} update={u} onMutated={async () => setUpdates(await fetchUpdates())} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="post" className="mt-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Post a new HR Update</h2>
            <form onSubmit={handlePostUpdate} className="flex flex-col gap-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
                <Input 
                  placeholder="E.g. New Policy Update" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Message</label>
                <Textarea 
                  placeholder="Detail the update or announcement..." 
                  className="min-h-[120px]"
                  value={body}
                  onChange={e => setBody(e.target.value)}
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
