import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/format'
import { getInitials } from '@/lib/utils'
import { useAuthContext } from '@/lib/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { SupervisorUpdate, HrUpdate } from '@/types'

type UpdateEntry =
  | (SupervisorUpdate & { type: 'supervisor' })
  | (HrUpdate & { type: 'hr' })

interface UpdateCardProps {
  update: UpdateEntry
  onMutated: () => void
}

export function UpdateCard({ update, onMutated }: UpdateCardProps) {
  const { profile } = useAuthContext()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(update.body)
  const [editTitle, setEditTitle] = useState('title' in update ? update.title : '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwner = profile?.id === update.author_id
  const table = update.type === 'hr' ? 'hr_updates' : 'supervisor_updates'

  async function handleSave() {
    setSaving(true)
    const payload: Record<string, string> = { body: editBody.trim() }
    if (update.type === 'hr') payload.title = editTitle.trim()

    const { error } = await supabase.from(table).update(payload).eq('id', update.id)
    setSaving(false)

    if (error) {
      toast.error(`Failed to save: ${error.message}`)
    } else {
      toast.success('Update saved')
      setEditing(false)
      onMutated()
    }
  }

  async function handleDelete() {
    const { error } = await supabase.from(table).delete().eq('id', update.id)
    if (error) {
      toast.error(`Failed to delete: ${error.message}`)
    } else {
      toast.success('Update deleted')
      onMutated()
    }
    setConfirmDelete(false)
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={update.author?.avatar_url || ''} />
            <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-600">
              {getInitials(update.author?.full_name || 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-900">
              {update.author?.full_name || 'Unknown'}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {update.type === 'hr' ? 'HR Update' : 'Supervisor Update'}
              </span>
            </p>
            <p className="text-xs text-zinc-500">{timeAgo(update.created_at)}</p>
          </div>

          {/* Actions — only visible to the author */}
          {isOwner && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-700">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  className="gap-2 text-sm"
                  onClick={() => {
                    setEditBody(update.body)
                    if (update.type === 'hr') setEditTitle((update as HrUpdate).title ?? '')
                    setEditing(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-sm text-red-600 focus:text-red-600"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="mt-3 flex flex-col gap-3">
            {update.type === 'hr' && (
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-[#a31e22] focus:outline-none"
                placeholder="Title"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
            )}
            <Textarea
              className="min-h-[80px] text-sm"
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#a31e22] hover:bg-[#8a181c] text-white"
                disabled={saving || !editBody.trim()}
                onClick={handleSave}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {update.type === 'hr' && (update as HrUpdate).title && (
              <h3 className="mt-3 text-sm font-semibold text-zinc-900">{(update as HrUpdate).title}</h3>
            )}
            <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{update.body}</p>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the update and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
