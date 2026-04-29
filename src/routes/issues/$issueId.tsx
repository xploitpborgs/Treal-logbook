import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import type { LogEntry, LogComment, Profile, Status } from '@/types'
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
import { formatDateTime, formatDepartment, formatCategory, formatShift, timeAgo, getInitials } from '@/lib/formatters'
import { ArrowLeft, Building2, Calendar, CircleCheck, Clock, MessageSquare, Tag } from 'lucide-react'

export const Route = createFileRoute('/issues/$issueId')({
  component: IssueView,
})

type AuthorSlim = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'department'> & { role: Profile['role'] }

type IssueFull = LogEntry & {
  author?: AuthorSlim
  resolver?: Pick<Profile, 'id' | 'full_name'> | null
  comments?: (LogComment & { author?: AuthorSlim })[]
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  switch (priority) {
    case 'urgent': return <Badge className="bg-[#C41E3A]/10 text-[#C41E3A] border-transparent shadow-none">Urgent</Badge>
    case 'high':   return <Badge className="bg-amber-100 text-amber-700 border-transparent shadow-none">High</Badge>
    case 'medium': return <Badge className="bg-blue-100 text-blue-700 border-transparent shadow-none">Medium</Badge>
    case 'low':    return <Badge className="bg-zinc-100 text-zinc-500 border-transparent shadow-none">Low</Badge>
    default:       return null
  }
}

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'open':        return <Badge className="bg-zinc-100 text-zinc-600 border-transparent shadow-none">Open</Badge>
    case 'in_progress': return <Badge className="bg-amber-100 text-amber-700 border-transparent shadow-none">In Progress</Badge>
    case 'resolved':    return <Badge className="bg-green-100 text-green-700 border-transparent shadow-none">Resolved</Badge>
    default:            return null
  }
}

const STATUS_BUTTONS = [
  { value: 'open',        label: 'Open',        active: 'bg-zinc-600 text-white',   inactive: 'border-zinc-200 text-zinc-600 hover:bg-zinc-50' },
  { value: 'in_progress', label: 'In Progress', active: 'bg-amber-500 text-white',  inactive: 'border-zinc-200 text-amber-600 hover:bg-amber-50' },
  { value: 'resolved',    label: 'Resolved',    active: 'bg-green-600 text-white',  inactive: 'border-zinc-200 text-green-600 hover:bg-green-50' },
]

function IssueView() {
  const { issueId } = Route.useParams()
  const { profile, canUpdateIssueStatus } = useRole()

  const [issue, setIssue]                     = useState<IssueFull | null>(null)
  const [loading, setLoading]                 = useState(true)
  const [updatingStatus, setUpdatingStatus]   = useState(false)
  const [resolveOpen, setResolveOpen]         = useState(false)
  const [pendingStatus, setPendingStatus]     = useState<string | null>(null)
  const [newComment, setNewComment]           = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const fetchIssue = async (background = false) => {
    if (!background) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('log_entries')
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url, department, role),
          resolver:profiles!resolved_by(id, full_name),
          comments:log_comments(*, author:profiles!author_id(id, full_name, avatar_url, department, role))
        `)
        .eq('id', issueId)
        .single()
      if (error) {
        toast.error('Failed to load issue')
      } else if (data) {
        const typed = data as unknown as IssueFull
        typed.comments?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        setIssue(typed)
      }
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    fetchIssue()
    const channel = supabase
      .channel(`issue_${issueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_entries', filter: `id=eq.${issueId}` }, () => {
        fetchIssue(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_comments', filter: `entry_id=eq.${issueId}` }, (payload) => {
        fetchIssue(true)
        if (payload.new.author_id !== profile?.id) toast('New comment added')
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [issueId, profile?.id])

  const canUpdate = !!(issue && profile && canUpdateIssueStatus(issue.author_id))

  const applyStatus = async (newStatus: string) => {
    if (!issue || !profile) return
    setUpdatingStatus(true)
    const updates: Partial<LogEntry> = {
      status: newStatus as Status,
      updated_at: new Date().toISOString(),
      resolved_by:  newStatus === 'resolved' ? profile.id : undefined,
      resolved_at:  newStatus === 'resolved' ? new Date().toISOString() : undefined,
    }
    const { error } = await supabase.from('log_entries').update(updates).eq('id', issueId)
    setUpdatingStatus(false)
    if (error) {
      toast.error('Failed to update status')
    } else {
      toast.success(`Status → ${newStatus.replace('_', ' ')}`)
      setIssue({ ...issue, ...updates } as IssueFull)
    }
  }

  const handleStatusClick = (newStatus: string) => {
    if (newStatus === 'resolved') {
      setPendingStatus(newStatus)
      setResolveOpen(true)
    } else {
      applyStatus(newStatus)
    }
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !profile) return
    setSubmittingComment(true)
    const { error } = await supabase
      .from('log_comments')
      .insert([{ entry_id: issueId, comment: newComment.trim(), author_id: profile.id }])
    setSubmittingComment(false)
    if (error) {
      toast.error('Failed to post comment')
    } else {
      toast.success('Comment added')
      setNewComment('')
      fetchIssue(true)
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 pb-12">

        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : !issue ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200">
            <p className="text-zinc-500">Issue not found</p>
            <Link to="/dashboard" className="mt-4 text-[#C41E3A] hover:underline text-sm">Return to dashboard</Link>
          </div>
        ) : (
          <>
            {/* Issue detail card */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <PriorityBadge priority={issue.priority} />
                  <StatusBadge status={issue.status} />
                </div>

                <h1 className="text-xl font-semibold text-zinc-900 mb-4">{issue.title}</h1>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{formatDepartment(issue.department)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{formatShift(issue.shift)} Shift</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Tag className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{formatCategory(issue.category)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{formatDateTime(issue.created_at)}</span>
                  </div>
                </div>

                {issue.author && (
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
                      {getInitials(issue.author.full_name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{issue.author.full_name}</p>
                      <p className="text-xs text-zinc-400">
                        {formatDepartment(issue.author.department)} · {timeAgo(issue.created_at)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t border-zinc-100 mb-5" />
                <div className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">{issue.body}</div>

                {issue.status === 'resolved' && (
                  <div className="mt-5 flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
                    <CircleCheck className="h-5 w-5 shrink-0 text-green-600" />
                    <p className="text-sm text-green-700">
                      Resolved by{' '}
                      <span className="font-medium">{issue.resolver?.full_name ?? 'a team member'}</span>
                      {issue.resolved_at && ` on ${formatDateTime(issue.resolved_at)}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status update panel */}
            {canUpdate && (
              <Card className="border-zinc-200 shadow-none">
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-medium text-zinc-700">Update Status</p>
                  <div className="flex gap-2">
                    {STATUS_BUTTONS.map(({ value, label, active, inactive }) => (
                      <button
                        key={value}
                        onClick={() => handleStatusClick(value)}
                        disabled={updatingStatus || issue.status === value}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs sm:text-sm font-medium transition-colors disabled:cursor-default ${
                          issue.status === value ? active : inactive
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-sm font-medium text-zinc-700">Comments</h2>
                  {(issue.comments?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs">
                      {issue.comments!.length}
                    </Badge>
                  )}
                </div>

                {!issue.comments?.length ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="mb-2 h-8 w-8 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-500">No comments yet</p>
                    <p className="text-xs text-zinc-400">Be the first to add a follow-up note</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {issue.comments.map((comment, idx) => (
                      <div key={comment.id}>
                        <div className="flex gap-3 py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
                            {getInitials(comment.author?.full_name ?? '')}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-zinc-900">{comment.author?.full_name}</span>
                              <span className="text-xs text-zinc-400 shrink-0">{timeAgo(comment.created_at)}</span>
                            </div>
                            {comment.author?.department && (
                              <p className="text-xs text-zinc-400">{formatDepartment(comment.author.department)}</p>
                            )}
                            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{comment.comment}</p>
                          </div>
                        </div>
                        {idx < issue.comments!.length - 1 && <div className="border-t border-zinc-100" />}
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}

                <div className="mt-4 border-t border-zinc-100 pt-4 space-y-3">
                  <Textarea
                    placeholder="Add a follow-up note, update or action taken..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-y"
                    rows={3}
                    disabled={submittingComment}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{newComment.length} chars</span>
                    <Button
                      onClick={handleCommentSubmit}
                      disabled={!newComment.trim() || submittingComment}
                      className="bg-[#C41E3A] text-white hover:bg-[#a31e22]"
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

      <AlertDialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as resolved?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the issue. You can re-open it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                setResolveOpen(false)
                if (pendingStatus) applyStatus(pendingStatus)
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
