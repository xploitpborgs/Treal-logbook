import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/lib/AuthContext'
import type { LogEntry, LogComment, Status, Profile } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { ArrowLeft, Building2, Calendar, CircleCheck, Clock, MessageSquare, Pencil, Tag } from 'lucide-react'
import { DEPT_LABELS, CATEGORY_LABELS, SHIFT_LABELS } from '@/lib/constants'

export const Route = createFileRoute('/entries/$id')({
  component: EntryView,
})

type AuthorSlim = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'department'> & { role: Profile['role'] }

type EntryFull = LogEntry & {
  author?: AuthorSlim
  resolver?: Pick<Profile, 'id' | 'full_name'> | null
  comments?: (LogComment & { author?: AuthorSlim })[]
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMins = Math.floor(diffInMs / 1000 / 60)

  if (diffInMins < 1) return 'Just now'
  if (diffInMins < 60) return `${diffInMins} minutes ago`

  const diffInHours = Math.floor(diffInMins / 60)
  if (diffInHours < 24) return `${diffInHours} hours ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} days ago`

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  switch (priority) {
    case 'urgent': return <Badge className="bg-[#a31e22]/10 text-[#a31e22] hover:bg-[#a31e22]/20 border-transparent shadow-none">Urgent</Badge>
    case 'high':   return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-transparent shadow-none">High</Badge>
    case 'medium': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-transparent shadow-none">Medium</Badge>
    case 'low':    return <Badge className="bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border-transparent shadow-none">Low</Badge>
    default:       return null
  }
}

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'open':        return <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-transparent shadow-none">Open</Badge>
    case 'in_progress': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-transparent shadow-none">In Progress</Badge>
    case 'resolved':    return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-transparent shadow-none">Resolved</Badge>
    case 'escalated':   return <Badge className="bg-[#a31e22] text-white hover:bg-[#8a181c] border-transparent shadow-none">Escalated</Badge>
    default:            return null
  }
}

function EntryView() {
  const { id } = Route.useParams()
  const { profile } = useAuthContext()

  const [entry, setEntry] = useState<EntryFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [resolveConfirmOpen, setResolveConfirmOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const fetchEntry = async (isBackground = false) => {
    if (!isBackground) setLoading(true)

    try {
      const { data, error } = await supabase
        .from('log_entries')
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url, department, role),
          resolver:profiles!resolved_by(id, full_name),
          comments:log_comments(
            *,
            author:profiles!author_id(id, full_name, avatar_url, department, role)
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        toast.error(`Failed to load entry: ${error.message || error.details || 'Unknown error'}`)
        console.error(error)
      } else if (data) {
        const typedData = data as unknown as EntryFull
        if (typedData.comments) {
          typedData.comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }
        setEntry(typedData)
      }
    } catch (err) {
      console.error('Fetch exception:', err)
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntry()

    const channel = supabase
      .channel(`entry_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_entries', filter: `id=eq.${id}` }, (payload) => {
        fetchEntry(true)
        if (payload.eventType === 'UPDATE') toast('Entry updated')
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_comments', filter: `entry_id=eq.${id}` }, (payload) => {
        fetchEntry(true)
        if (payload.new.author_id !== profile?.id) toast('New comment added')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, profile?.id])

  const canUpdateStatus = !!(profile && entry && (
    profile.id === entry.author_id ||
    profile.role === 'supervisor' ||
    profile.role === 'gm' ||
    profile.role === 'system_admin'
  ))

  const canEdit = !!(profile && entry && (
    profile.id === entry.author_id ||
    profile.role === 'gm' ||
    profile.role === 'system_admin'
  ))

  const applyStatusChange = async (newStatus: string) => {
    if (!entry || !profile) return
    setUpdatingStatus(true)

    const updates: Partial<LogEntry> = {
      status: newStatus as Status,
      updated_at: new Date().toISOString(),
      resolved_by: newStatus === 'resolved' ? profile.id : null,
      resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
    }

    const { error } = await supabase.from('log_entries').update(updates).eq('id', id)
    setUpdatingStatus(false)

    if (error) {
      toast.error(`Failed to update status: ${error.message || error.details}`)
    } else {
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`)
      setEntry({ ...entry, ...updates } as EntryFull)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'resolved') {
      setPendingStatus(newStatus)
      setResolveConfirmOpen(true)
    } else {
      applyStatusChange(newStatus)
    }
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !profile) return

    setSubmittingComment(true)
    const { error } = await supabase
      .from('log_comments')
      .insert([{ entry_id: id, comment: newComment.trim(), author_id: profile.id }])

    setSubmittingComment(false)

    if (error) {
      toast.error(`Failed to post comment: ${error.message || error.details}`)
    } else {
      toast.success('Comment added')
      setNewComment('')
      fetchEntry(true)
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }

  return (
    <AppLayout title="Entry Details">
      <div className="mx-auto max-w-3xl space-y-6 pb-12">

        {/* Back + Edit header row */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          {!loading && canEdit && (
            <Link to="/entries/$id/edit" params={{ id }}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-zinc-500 hover:text-zinc-900">
                <Pencil className="h-4 w-4" />
                Edit Entry
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : !entry ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200">
            <p className="text-zinc-500">Entry not found</p>
            <Link to="/dashboard" className="mt-4 text-brand hover:underline text-sm">
              Return to dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Entry Details Card */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-4 sm:p-6">
                {/* Badges + title */}
                <div className="flex items-center gap-2 mb-3">
                  <PriorityBadge priority={entry.priority} />
                  <StatusBadge status={entry.status} />
                </div>

                <h1 className="text-xl font-semibold text-zinc-900 mb-4">{entry.title}</h1>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{DEPT_LABELS[entry.department] || entry.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{SHIFT_LABELS[entry.shift] || entry.shift} Shift</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Tag className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{CATEGORY_LABELS[entry.category] || entry.category}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{formatDate(entry.created_at)}</span>
                  </div>
                </div>

                {/* Author row */}
                {entry.author && (
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a31e22] text-xs font-semibold text-white">
                      {getInitials(entry.author.full_name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{entry.author.full_name}</p>
                      <p className="text-xs text-zinc-400">
                        {DEPT_LABELS[entry.author.department]} · {formatTimeAgo(entry.created_at)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t border-zinc-100 mb-5" />

                {/* Body */}
                <div className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
                  {entry.body}
                </div>

                {/* Resolved banner */}
                {entry.status === 'resolved' && (
                  <div className="mt-5 flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
                    <CircleCheck className="h-5 w-5 shrink-0 text-green-600" />
                    <p className="text-sm text-green-700">
                      Resolved by{' '}
                      <span className="font-medium">{entry.resolver?.full_name ?? 'a team member'}</span>
                      {entry.resolved_at && ` on ${formatDate(entry.resolved_at)}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Update Panel */}
            {canUpdateStatus && (
              <Card className="border-zinc-200 shadow-none">
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-medium text-zinc-700">Update Status</p>
                  <div className="flex gap-2">
                    {[
                      { value: 'open', label: 'Open', active: 'bg-zinc-600 text-white', inactive: 'border-zinc-200 text-zinc-600 hover:bg-zinc-50' },
                      { value: 'in_progress', label: 'In Progress', active: 'bg-amber-500 text-white', inactive: 'border-zinc-200 text-amber-600 hover:bg-amber-50' },
                      { value: 'resolved', label: 'Resolved', active: 'bg-green-600 text-white', inactive: 'border-zinc-200 text-green-600 hover:bg-green-50' },
                      // Conditionally add Escalated
                      ...(profile.role === 'supervisor' || profile.role === 'gm' || profile.role === 'system_admin'
                        ? [{ value: 'escalated', label: 'Escalated', active: 'bg-[#a31e22] text-white', inactive: 'border-zinc-200 text-[#a31e22] hover:bg-red-50' }]
                        : [])
                    ].map(({ value, label, active, inactive }) => (
                      <button
                        key={value}
                        onClick={() => handleStatusChange(value)}
                        disabled={updatingStatus || entry.status === value}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs sm:text-sm font-medium transition-colors disabled:cursor-default ${
                          entry.status === value ? active : inactive
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments Card */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-sm font-medium text-zinc-700">Comments</h2>
                  {(entry.comments?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs">
                      {entry.comments!.length}
                    </Badge>
                  )}
                </div>

                {/* Comment list */}
                {(!entry.comments || entry.comments.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="mb-2 h-8 w-8 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-500">No comments yet</p>
                    <p className="text-xs text-zinc-400">Be the first to add a follow-up note</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {entry.comments.map((comment, idx) => (
                      <div key={comment.id}>
                        <div className="flex gap-3 py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a31e22] text-xs font-semibold text-white">
                            {getInitials(comment.author?.full_name ?? '')}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-zinc-900">
                                {comment.author?.full_name}
                              </span>
                              <span className="text-xs text-zinc-400 shrink-0">
                                {formatTimeAgo(comment.created_at)}
                              </span>
                            </div>
                            {comment.author?.department && (
                              <p className="text-xs text-zinc-400">
                                {DEPT_LABELS[comment.author.department]}
                              </p>
                            )}
                            <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                              {comment.comment}
                            </p>
                          </div>
                        </div>
                        {idx < entry.comments!.length - 1 && (
                          <div className="border-t border-zinc-100" />
                        )}
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}

                {/* Add comment form */}
                <div className="mt-4 border-t border-zinc-100 pt-4 space-y-3">
                  <Textarea
                    placeholder="Add a follow-up note, update or action taken..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-y bg-white"
                    rows={3}
                    disabled={submittingComment}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{newComment.length} chars</span>
                    <Button
                      onClick={handleCommentSubmit}
                      disabled={!newComment.trim() || submittingComment}
                      className="bg-[#a31e22] text-white hover:bg-[#82181b]"
                    >
                      {submittingComment ? 'Posting...' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Resolve confirmation dialog */}
      <AlertDialog open={resolveConfirmOpen} onOpenChange={setResolveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as resolved?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the entry. You can re-open it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                setResolveConfirmOpen(false)
                if (pendingStatus) applyStatusChange(pendingStatus)
                setPendingStatus(null)
              }}
            >
              Mark Resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
