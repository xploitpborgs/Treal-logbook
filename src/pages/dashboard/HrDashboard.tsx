import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayLabel, timeAgo } from '@/lib/format'
import { useAuthContext } from '@/lib/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SupervisorUpdate, HrUpdate } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type CombinedUpdate = (SupervisorUpdate & { type: 'supervisor' }) | (HrUpdate & { type: 'hr' })

export function HrDashboard() {
  const { profile } = useAuthContext()
  const [activeTab, setActiveTab] = useState('feed')
  const [updates, setUpdates] = useState<CombinedUpdate[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

    fetchUpdates().then(data => {
      if (!cancelled) {
        setUpdates(data)
        setLoading(false)
      }
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

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [fetchUpdates, activeTab])

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
