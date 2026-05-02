import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/format'
import { cn, getInitials } from '@/lib/utils'
import { useAuthContext } from '@/lib/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MessageSquare, MoreHorizontal, Pencil, Send, Trash2, X } from 'lucide-react'
import type { SupervisorUpdate, HRUpdate, GMUpdate } from '@/types'

export type UpdateEntry =
  | (SupervisorUpdate & { type: 'supervisor' })
  | (HRUpdate        & { type: 'hr' })
  | (GMUpdate        & { type: 'gm' })
  | (any             & { type: 'staff' })

const TYPE_CONFIG = {
  supervisor: { label: 'Supervisor Update', borderColor: 'border-l-blue-400',   badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  hr:         { label: 'HR Update',         borderColor: 'border-l-purple-400', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  gm:         { label: 'GM Update',         borderColor: 'border-l-amber-400',  badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  staff:      { label: 'Staff Update',      borderColor: 'border-l-sky-400',    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
}

const TRUNCATE_AT = 220

function getTable(type: UpdateEntry['type']) {
  if (type === 'hr')    return 'hr_updates'
  if (type === 'gm')    return 'gm_updates'
  if (type === 'staff') return 'staff_updates'
  return 'supervisor_updates'
}

interface UpdateCardProps {
  update: UpdateEntry
  onMutated: () => void
}

export function UpdateCard({ update, onMutated }: UpdateCardProps) {
  const { profile } = useAuthContext()
  const [editing, setEditing]             = useState(false)
  const [editBody, setEditBody]           = useState(update.body)
  const [editTitle, setEditTitle]         = useState('title' in update ? (update as any).title ?? '' : '')
  const [saving, setSaving]               = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sheetOpen, setSheetOpen]         = useState(false)
  const [hasNewComments, setHasNewComments] = useState(false)
  const [comments, setComments]           = useState<any[]>([])
  const [newComment, setNewComment]       = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [loadingComments, setLoadingComments]     = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const isOwner    = profile?.id === update.author_id
  const table      = getTable(update.type)
  const typeConfig = (TYPE_CONFIG as any)[update.type]
  const hasTitle   = update.type === 'hr' || update.type === 'gm' || update.type === 'staff'
  const isLong     = (update.body?.length ?? 0) > TRUNCATE_AT

  const fetchComments = async () => {
    setLoadingComments(true)
    const { data } = await supabase
      .from('update_comments')
      .select('*, author:profiles(id, full_name, avatar_url, role)')
      .eq('update_id', update.id)
      .eq('update_type', update.type)
      .order('created_at', { ascending: true })
    const fetched = data || []
    setComments(fetched)
    setLoadingComments(false)
    if (fetched.length > 0) {
      const lastSeen = localStorage.getItem(`last_seen_comments_${update.id}`)
      // Find the newest comment that ISN'T by the current user
      const newestOtherComment = [...fetched].reverse().find(c => c.author_id !== profile?.id)
      
      if (newestOtherComment) {
        const latestTime = new Date(newestOtherComment.created_at).getTime()
        if (!lastSeen || latestTime > parseInt(lastSeen)) {
          setHasNewComments(true)
        }
      }
    }
  }

  useEffect(() => {
    fetchComments()
    const channel = supabase
      .channel(`comments-${update.id}`)
      .on('postgres_changes', {
        event: 'INSERT', 
        schema: 'public', 
        table: 'update_comments',
        filter: `update_id=eq.${update.id}`,
      }, (payload) => { 
        fetchComments()
        const newComment = payload.new as any
        if (!sheetOpen && newComment.author_id !== profile?.id) {
          setHasNewComments(true)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [update.id])

  useEffect(() => {
    if (sheetOpen) {
      setHasNewComments(false)
      localStorage.setItem(`last_seen_comments_${update.id}`, Date.now().toString())
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
    }
  }, [sheetOpen, update.id])

  async function handleSave() {
    setSaving(true)
    const payload: Record<string, string> = { body: editBody.trim() }
    if (hasTitle) payload.title = editTitle.trim()
    const { error } = await supabase.from(table).update(payload).eq('id', update.id)
    setSaving(false)
    if (error) toast.error(`Failed to save: ${error.message}`)
    else { toast.success('Update saved'); setEditing(false); onMutated() }
  }

  async function handleDelete() {
    const { error } = await supabase.from(table).delete().eq('id', update.id)
    if (error) toast.error(`Failed to delete: ${error.message}`)
    else { toast.success('Update deleted'); onMutated() }
    setConfirmDelete(false)
  }

  async function handlePostComment() {
    if (!newComment.trim() || !profile) return
    setSubmittingComment(true)
    const { error } = await supabase.from('update_comments').insert({
      update_id: update.id, update_type: update.type,
      author_id: profile.id, comment: newComment.trim(),
    })
    setSubmittingComment(false)
    if (error) toast.error(`Failed to post: ${error.message}`)
    else {
      setNewComment('')
      await fetchComments()
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      {/* ── Feed Card ── */}
      <div
        className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm border-l-4 ${typeConfig.borderColor} ${!editing ? 'cursor-pointer hover:shadow-md hover:bg-zinc-50/40 transition-all' : ''}`}
        onClick={() => { if (!editing) setSheetOpen(true) }}
      >

        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={update.author?.avatar_url || ''} />
            <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-600">
              {getInitials(update.author?.full_name || 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-zinc-900 leading-none">{update.author?.full_name || 'Unknown'}</p>
              <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 border ${typeConfig.badgeClass}`}>
                {typeConfig.label}
              </Badge>
              {update.type === 'staff' && (update as any).target_staff && (
                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] px-1.5 py-0">
                  → {(update as any).target_staff.full_name}
                </Badge>
              )}
              {update.type === 'supervisor' && (update as any).team && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 uppercase">
                  {(update as any).team}
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(update.created_at)}</p>
          </div>

          {isOwner && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                  onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem className="gap-2 text-sm" onClick={() => {
                  setEditBody(update.body)
                  if (hasTitle) setEditTitle((update as any).title ?? '')
                  setEditing(true)
                }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-sm text-red-600 focus:text-red-600" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="mt-3 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            {hasTitle && <Input placeholder="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />}
            <Textarea className="min-h-[80px] text-sm" value={editBody} onChange={e => setEditBody(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="bg-[#C41E3A] hover:bg-[#a01830] text-white"
                disabled={saving || !editBody.trim()} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            {hasTitle && (update as any).title && (
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">{(update as any).title}</h3>
            )}
            <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3">{update.body}</p>
            {isLong && (
              <span className="mt-1 text-xs font-medium text-[#C41E3A]">Read more…</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div className="relative flex items-center gap-2 text-xs font-medium text-zinc-500">
            <div className="relative">
              <MessageSquare className={cn("h-4 w-4 transition-colors", hasNewComments ? "text-red-600" : "text-zinc-400")} />
              {comments.length > 0 && (
                <span className={cn(
                  "absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-white transition-all",
                  hasNewComments 
                    ? "bg-red-600 text-white animate-pulse" 
                    : "bg-zinc-100 text-zinc-600"
                )}>
                  {comments.length}
                </span>
              )}
            </div>
            <span className={comments.length > 0 ? 'text-zinc-900 ml-1' : ''}>
              {comments.length > 0 ? `${comments.length} Discussion${comments.length > 1 ? 's' : ''}` : 'Add Comment'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Detail Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">

          {/* Sheet header */}
          <div className={`flex items-start gap-3 border-b border-zinc-100 px-5 py-4 border-l-4 ${typeConfig.borderColor}`}>
            <Avatar className="h-9 w-9 shrink-0 mt-0.5">
              <AvatarImage src={update.author?.avatar_url || ''} />
              <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-600">
                {getInitials(update.author?.full_name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-zinc-900 leading-none">{update.author?.full_name || 'Unknown'}</p>
                <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 border ${typeConfig.badgeClass}`}>
                  {typeConfig.label}
                </Badge>
                {update.type === 'supervisor' && (update as any).team && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 uppercase">
                    {(update as any).team}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(update.created_at)}</p>
            </div>
            <button onClick={() => setSheetOpen(false)}
              className="ml-2 shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Full body */}
          <div className="shrink-0 border-b border-zinc-100 px-5 py-4">
            {hasTitle && (update as any).title && (
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">{(update as any).title}</h3>
            )}
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{update.body}</p>
          </div>

          {/* Comments — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-4">
              {comments.length > 0 ? `${comments.length} Discussion${comments.length > 1 ? 's' : ''}` : 'Discussion'}
            </p>
            {loadingComments && comments.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-zinc-400 py-2">No replies yet. Be the first to comment.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={c.author?.avatar_url || ''} />
                      <AvatarFallback className="text-[9px] bg-zinc-100">{getInitials(c.author?.full_name || 'U')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-zinc-900">{c.author?.full_name}</span>
                        <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{c.comment}</p>
                    </div>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>

          {/* Comment input — pinned bottom */}
          <div className="shrink-0 border-t border-zinc-100 px-5 py-4">
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="Write a comment… (Enter to send)"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className="flex-1 min-h-[40px] max-h-[120px] text-sm resize-none py-2.5"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() }
                }}
              />
              <Button size="icon" className="h-9 w-9 shrink-0 bg-zinc-900 hover:bg-zinc-700"
                disabled={!newComment.trim() || submittingComment} onClick={handlePostComment}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the update and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
