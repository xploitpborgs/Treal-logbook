import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { logAudit } from '@/lib/auditLogger'
import { notifyManagement } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TriangleAlert } from 'lucide-react'

interface EscalateDialogProps {
  entryId: string
  onEscalated: () => void
}

export function EscalateDialog({ entryId, onEscalated }: EscalateDialogProps) {
  const { profile } = useRole()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleEscalate() {
    if (!profile) return
    setSubmitting(true)
    const { error } = await supabase
      .from('log_entries')
      .update({
        is_escalated: true,
        escalated_by: profile.id,
        escalated_at: new Date().toISOString(),
        escalation_note: note.trim() || null,
      })
      .eq('id', entryId)
    setSubmitting(false)

    if (error) {
      toast.error(`Failed to escalate: ${error.message}`)
    } else {
      logAudit({ actorId: profile!.id, action: 'escalated', entityType: 'log_entry', entityId: entryId, note: note.trim() || 'Escalated to GM' })
      
      notifyManagement({
        title: 'New Escalation',
        message: `A new issue has been escalated by ${profile.full_name}: ${note.trim() || 'No note provided'}`,
        type: 'escalation',
        link: `/dashboard`, // Or a specific entry page if available
        priority: 'high'
      })

      toast.success('Issue escalated to GM')
      setOpen(false)
      setNote('')
      onEscalated()
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
        onClick={() => setOpen(true)}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        Escalate to GM
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Escalate this issue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will flag the issue for the General Manager's attention. Add an optional note explaining why.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            placeholder="Reason for escalation (optional)…"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="min-h-[80px] text-sm"
            disabled={submitting}
          />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={submitting}
              onClick={handleEscalate}
            >
              {submitting ? 'Escalating…' : 'Escalate'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
