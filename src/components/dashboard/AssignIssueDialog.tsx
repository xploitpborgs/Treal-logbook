import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { logAudit } from '@/lib/auditLogger'
import { useAuthContext } from '@/lib/AuthContext'
import type { Profile } from '@/types'
import { UserPlus } from 'lucide-react'

interface AssignIssueDialogProps {
  entryId: string
  department: string
  currentAssigneeId?: string | null
  onAssigned: () => void
}

export function AssignIssueDialog({ entryId, department, currentAssigneeId, onAssigned }: AssignIssueDialogProps) {
  const { profile } = useAuthContext()
  const [open, setOpen] = useState(false)
  const [staff, setStaff] = useState<Profile[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>(currentAssigneeId || 'unassigned')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset selectedStaff when opened
  useEffect(() => {
    if (open) {
      setSelectedStaff(currentAssigneeId || 'unassigned')
    }
  }, [open, currentAssigneeId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchStaff = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('department', department)
        .eq('is_active', true)
        .order('full_name')
      
      if (!cancelled && !error && data) {
        setStaff(data as Profile[])
      }
      setLoading(false)
    }
    fetchStaff()
    return () => { cancelled = true }
  }, [open, department])

  const handleAssign = async () => {
    if (!profile) return
    setSubmitting(true)

    const assignTo = selectedStaff === 'unassigned' ? null : selectedStaff
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('log_entries')
      .update({
        assigned_to: assignTo,
        assigned_by: assignTo ? profile.id : null,
        assigned_at: assignTo ? now : null,
        updated_at: now
      })
      .eq('id', entryId)

    setSubmitting(false)

    if (error) {
      toast.error(`Failed to assign issue: ${error.message}`)
    } else {
      logAudit({
        actorId: profile.id,
        action: 'updated',
        entityType: 'log_entry',
        entityId: entryId,
        note: assignTo ? `Assigned issue to ${staff.find(s => s.id === assignTo)?.full_name}` : 'Unassigned issue'
      })
      toast.success(assignTo ? 'Issue assigned' : 'Issue unassigned')
      setOpen(false)
      onAssigned()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <UserPlus className="h-3.5 w-3.5" />
          {currentAssigneeId ? 'Change Assignee' : 'Assign'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Issue</DialogTitle>
          <DialogDescription>
            Assign this issue to a staff member in the {formatDepartment(department)} department.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedStaff} onValueChange={setSelectedStaff} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {staff.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name} ({s.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAssign} 
            disabled={submitting || (selectedStaff === (currentAssigneeId || 'unassigned'))} 
            className="bg-[#C41E3A] text-white hover:bg-[#a01830]"
          >
            {submitting ? 'Saving...' : 'Save Assignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatDepartment(dept: string): string {
  return dept.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
