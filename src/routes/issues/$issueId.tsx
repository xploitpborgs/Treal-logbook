/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createFileRoute, useNavigate, useRouter, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { EscalateDialog } from '@/components/dashboard/EscalateDialog'
import { InvolveTeamDialog } from '@/components/dashboard/InvolveTeamDialog'
import { AssignIssueDialog } from '@/components/dashboard/AssignIssueDialog'
import type { LogEntry, LogComment, Profile, Status } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  formatDateTime, formatDepartment, formatCategory, formatShift, formatStatus,
  timeAgo, getInitials,
} from '@/lib/formatters'
import { logAudit } from '@/lib/auditLogger'
import {
  AlertCircle, ArrowLeft, ArrowUpCircle, Building2, Calendar,
  ChevronRight, CircleCheck, Clock, MessageSquare, Pencil, Tag, TriangleAlert,
} from 'lucide-react'

export const Route = createFileRoute('/issues/$issueId')({
  component: IssueView,
})

type ProfileSlim = Pick<Profile, 'id' | 'full_name' | 'department' | 'role'> & { team?: string; avatar_url?: string }

type IssueFull = Omit<LogEntry, 'author' | 'escalator' | 'resolver'> & {
  author?:    ProfileSlim | null
  escalator?: ProfileSlim | null
  resolver?:  ProfileSlim | null
  assignee?:  ProfileSlim | null
}

type CommentWithAuthor = LogComment & { author?: ProfileSlim | null }

const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, string> = {
    urgent: 'bg-[#C41E3A]/10 text-[#C41E3A] border-transparent',
    high:   'bg-amber-100 text-amber-700 border-transparent',
    medium: 'bg-blue-100 text-blue-700 border-transparent',
    low:    'bg-zinc-100 text-zinc-500 border-transparent',
  }
  const labels: Record<string, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
  return <Badge className={`shadow-none ${map[priority] ?? ''}`}>{labels[priority] ?? priority}</Badge>
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    open:        'bg-zinc-100 text-zinc-600 border-transparent',
    in_progress: 'bg-amber-100 text-amber-700 border-transparent',
    resolved:    'bg-green-100 text-green-700 border-transparent',
  }
  return <Badge className={`shadow-none ${map[status] ?? ''}`}>{formatStatus(status)}</Badge>
}

const STATUS_BUTTONS = [
  { value: 'open',        label: 'Open',        active: 'bg-zinc-600 text-white',  inactive: 'border-zinc-200 text-zinc-600 hover:bg-zinc-50' },
  { value: 'in_progress', label: 'In Progress', active: 'bg-amber-500 text-white', inactive: 'border-zinc-200 text-amber-600 hover:bg-amber-50' },
  { value: 'resolved',    label: 'Resolved',    active: 'bg-green-600 text-white', inactive: 'border-zinc-200 text-green-600 hover:bg-green-50' },
]

function IssueView() {
  const { issueId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const { profile, isHR, isGM, isStaff, isSupervisor, canUpdateIssueStatus, canEscalate, isAdmin } = useRole()

  const [issue, setIssue]                       = useState<IssueFull | null>(null)
  const [comments, setComments]                 = useState<CommentWithAuthor[]>([])
  const [loading, setLoading]                   = useState(true)
  const [notFound, setNotFound]                 = useState(false)
  const [updatingStatus, setUpdatingStatus]     = useState(false)
  const [resolveOpen, setResolveOpen]           = useState(false)
  const [pendingStatus, setPendingStatus]       = useState<string | null>(null)
  const [newComment, setNewComment]             = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const fetchIssue = useCallback(async () => {
    const { data, error } = await supabase
      .from('log_entries')
      .select(`
        *,
        author:profiles!author_id(id, full_name, department, team, role, avatar_url),
        escalator:profiles!escalated_by(id, full_name, department, team, role),
        resolver:profiles!resolved_by(id, full_name, department, team, role),
        assignee:profiles!assigned_to(id, full_name, department, team, role, avatar_url)
      `)
      .eq('id', issueId)
      .single()

    if (error || !data) {
      setNotFound(true)
      setLoading(false)
      return null
    }
    return data as unknown as IssueFull
  }, [issueId])

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('log_comments')
      .select('*, author:profiles(id, full_name, department, team, role, avatar_url)')
      .eq('entry_id', issueId)
      .order('created_at', { ascending: true })
    setComments((data as unknown as CommentWithAuthor[]) ?? [])
  }, [issueId])

  // Initial load
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([fetchIssue(), fetchComments()]).then(([issueData]) => {
      if (cancelled) return
      if (issueData) setIssue(issueData)
      setLoading(false)
      
      // Mark as seen
      localStorage.setItem(`last_seen_comments_log_${issueId}`, Date.now().toString())
    })
    return () => { cancelled = true }
  }, [issueId])

  // Access control — runs once issue and profile are loaded
  useEffect(() => {
    if (!profile || !issue || loading) return

    // NEW: Access for involved parties
    const involved = issue.involved_parties || []
    const isActuallyInvolved = 
      involved.includes('All Management') && (isSupervisor() || isGM() || isAdmin() || isHR()) ||
      involved.includes(profile.role === 'system_admin' ? 'System Admin' : '') ||
      involved.includes(profile.role === 'hr' ? 'HR' : '') ||
      involved.includes(`supervisor:${profile.department}`)

    if (isActuallyInvolved) return // Access granted

    if (isHR()) {
      toast.error('HR does not have access to issue details.')
      navigate({ to: '/dashboard' })
      return
    }
    if (isGM() && !issue.is_escalated && issue.author?.role !== 'supervisor') {
      toast.error('You can only view escalated or supervisor issues.')
      navigate({ to: '/dashboard' })
      return
    }
    const profileTeam = profile.team ?? profile.department
    if (isStaff() && issue.team !== profileTeam && issue.author_id !== profile.id) {
      toast.error('You do not have access to this issue.')
      navigate({ to: '/dashboard' })
    }
  }, [profile, issue, loading])

  // Realtime subscription for comments
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${issueId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'log_comments',
        filter: `entry_id=eq.${issueId}`,
      }, payload => {
        fetchComments()
        if ((payload.new as { author_id: string }).author_id !== profile?.id) {
          toast.info('New comment added')
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [issueId, profile?.id, fetchComments])

  // Realtime for issue updates
  useEffect(() => {
    const channel = supabase
      .channel(`issue-${issueId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'log_entries',
        filter: `id=eq.${issueId}`,
      }, () => { fetchIssue().then(d => { if (d) setIssue(d) }) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [issueId, fetchIssue])

  const applyStatus = async (newStatus: string) => {
    if (!issue || !profile) return
    setUpdatingStatus(true)
    const updates: Partial<LogEntry> = {
      status:      newStatus as Status,
      updated_at:  new Date().toISOString(),
      resolved_by: newStatus === 'resolved' ? profile.id : undefined,
      resolved_at: newStatus === 'resolved' ? new Date().toISOString() : undefined,
    }
    const { error } = await supabase.from('log_entries').update(updates).eq('id', issueId)
    setUpdatingStatus(false)
    if (error) {
      toast.error('Failed to update status')
    } else {
      const auditAction = newStatus === 'resolved' ? 'resolved' : 'status_changed'
      logAudit({ actorId: profile!.id, action: auditAction, entityType: 'log_entry', entityId: issueId, oldData: { status: issue.status }, newData: { status: newStatus } })
      toast.success(`Status updated to ${formatStatus(newStatus)}`)
      setIssue(prev => prev ? { ...prev, ...updates } as IssueFull : prev)
    }
  }

  const handleStatusClick = (newStatus: string) => {
    if (newStatus === 'resolved') { setPendingStatus(newStatus); setResolveOpen(true) }
    else applyStatus(newStatus)
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !profile) return
    setSubmittingComment(true)
    const { error } = await supabase
      .from('log_comments')
      .insert({ entry_id: issueId, author_id: profile.id, comment: newComment.trim() })
    setSubmittingComment(false)
    if (error) {
      toast.error('Failed to post comment')
    } else {
      logAudit({ actorId: profile!.id, action: 'commented', entityType: 'log_entry', entityId: issueId, note: 'Comment added' })
      toast.success('Comment added')
      setNewComment('')
      await fetchComments()
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const canUpdate = !!(issue && profile && canUpdateIssueStatus(issue.author_id) && !isGM())
  const showEscalatePanel = canEscalate() && issue && !issue.is_escalated
  const showEscalatedInfo = issue?.is_escalated
  const canEdit = issue && (profile?.id === issue.author_id || isAdmin())

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl space-y-6 pb-12">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AppLayout>
    )
  }

  // Not found
  if (notFound || !issue) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-zinc-200 py-24">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <div className="text-center">
              <p className="font-medium text-zinc-700">Issue not found</p>
              <p className="mt-1 text-sm text-zinc-400">This issue may have been deleted or you do not have access.</p>
            </div>
            <Button variant="outline" onClick={() => navigate({ to: '/dashboard' })}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const titleDisplay = issue.title.length > 60 ? `${issue.title.slice(0, 60)}…` : issue.title

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-300">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-zinc-400">
          <button
            onClick={() => router.history.back()}
            className="flex items-center gap-1 hover:text-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isStaff() ? 'My Issues' : 'Dashboard'}</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
          <span className="truncate text-zinc-500 max-w-[200px] sm:max-w-sm">{titleDisplay}</span>
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 leading-snug">{issue.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
              {issue.is_escalated && (
                <Badge className="bg-[#C41E3A]/10 text-[#C41E3A] border-transparent shadow-none">
                  Escalated
                </Badge>
              )}
              {issue.assignee && (
                <Badge className="bg-indigo-100 text-indigo-700 border-transparent shadow-none">
                  Assigned to: {issue.assignee.full_name}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isSupervisor() || isGM() || isAdmin()) && issue.status !== 'resolved' && (
              <AssignIssueDialog
                entryId={issue.id}
                department={issue.department}
                currentAssigneeId={issue.assignee?.id}
                onAssigned={() => fetchIssue().then(d => { if (d) setIssue(d) })}
              />
            )}
            {canEdit && (
              <Link to="/issues/$issueId/edit" params={{ issueId }}>
                <Button variant="ghost" size="icon" className="shrink-0 text-zinc-400 hover:text-zinc-700">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Issue detail card */}
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-4 sm:p-6">

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 min-w-0">
                <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{formatDepartment(issue.team ?? issue.department)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 min-w-0">
                <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{formatShift(issue.shift)} Shift</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 min-w-0">
                <Tag className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{formatCategory(issue.category)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 min-w-0">
                <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{formatDateTime(issue.created_at)}</span>
              </div>
            </div>

            {/* Author */}
            {issue.author && (
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
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

            {/* Escalation banner */}
            {showEscalatedInfo && (
              <div className="mb-5 flex items-start gap-3 rounded-md border border-[#C41E3A]/20 bg-[#C41E3A]/5 px-4 py-3">
                <ArrowUpCircle className="h-5 w-5 shrink-0 text-[#C41E3A]" />
                <div className="text-sm">
                  <p className="font-medium text-[#C41E3A]">
                    Escalated by {issue.escalator?.full_name ?? 'a supervisor'}
                    {issue.escalated_at && ` · ${timeAgo(issue.escalated_at)}`}
                  </p>
                  {issue.escalation_note && (
                    <p className="mt-0.5 italic text-[#C41E3A]/80">{issue.escalation_note}</p>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-zinc-100 mb-5" />

            {/* Body */}
            <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 leading-relaxed">{issue.body}</p>

            {/* Resolved banner */}
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

        {/* Escalation & Involvement panel */}
        {(showEscalatePanel || (isGM() || isAdmin()) && issue.is_escalated) && issue.status !== 'resolved' && (
          <Card className="border-zinc-200 shadow-none">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  {showEscalatePanel ? 'Escalate Issue' : 'Management Collaboration'}
                </p>
                <p className="text-xs text-zinc-400">
                  {showEscalatePanel 
                    ? 'Send this issue to the GM for review' 
                    : 'Add other supervisors or departments to this conversation'}
                </p>
              </div>
              <div className="flex gap-2">
                {showEscalatePanel && (
                  <EscalateDialog
                    entryId={issueId}
                    onEscalated={() => fetchIssue().then(d => { if (d) setIssue(d) })}
                  />
                )}
                {(isGM() || isAdmin()) && issue.is_escalated && (
                  <InvolveTeamDialog
                    entryId={issueId}
                    currentInvolved={issue.involved_parties}
                    onUpdated={() => fetchIssue().then(d => { if (d) setIssue(d) })}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already escalated info card (for non-supervisor roles) */}
        {showEscalatedInfo && !canEscalate() && (
          <Card className="border-[#C41E3A]/20 shadow-none bg-[#C41E3A]/5">
            <CardContent className="p-4 flex items-start gap-3">
              <TriangleAlert className="h-5 w-5 shrink-0 text-[#C41E3A] mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-[#C41E3A]">This issue has been escalated</p>
                <p className="text-xs text-[#C41E3A]/70 mt-0.5">
                  Escalated by {issue.escalator?.full_name ?? 'a supervisor'}
                  {issue.escalated_at && ` on ${formatDateTime(issue.escalated_at)}`}
                </p>
                {issue.escalation_note && (
                  <p className="text-xs italic text-[#C41E3A]/70 mt-1">{issue.escalation_note}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments */}
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-sm font-medium text-zinc-700">Comments</h2>
              {comments.length > 0 && (
                <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs">{comments.length}</Badge>
              )}
            </div>

            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="mb-2 h-8 w-8 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No comments yet</p>
                <p className="text-xs text-zinc-400">Be the first to add a follow-up note</p>
              </div>
            ) : (
              <div className="space-y-0">
                {comments.map((comment, idx) => (
                  <div key={comment.id}>
                    <div className="flex gap-3 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
                        {getInitials(comment.author?.full_name ?? 'U')}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-900">{comment.author?.full_name}</span>
                          <span className="text-xs text-zinc-400 shrink-0">{timeAgo(comment.created_at)}</span>
                        </div>
                        {comment.author?.department && (
                          <p className="text-xs text-zinc-400">{formatDepartment(comment.author.department)}</p>
                        )}
                        <p className="text-sm text-zinc-700 whitespace-pre-wrap break-words">{comment.comment}</p>
                      </div>
                    </div>
                    {idx < comments.length - 1 && <div className="border-t border-zinc-100" />}
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}

            {/* Add comment */}
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
                  className="bg-[#C41E3A] text-white hover:bg-[#a01830]"
                >
                  {submittingComment ? 'Posting…' : 'Add Comment'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resolve confirmation dialog */}
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
