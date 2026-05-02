import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { DEPT_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Users, Shield, UserCog, Building2 } from 'lucide-react'

interface InvolveTeamDialogProps {
  entryId: string
  currentInvolved?: string[]
  onUpdated: () => void
}

export function InvolveTeamDialog({ entryId, currentInvolved = [], onUpdated }: InvolveTeamDialogProps) {
  const { profile } = useRole()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(currentInvolved)
  const [submitting, setSubmitting] = useState(false)

  const toggle = (val: string) => {
    setSelected(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function handleUpdate() {
    if (!profile) return
    setSubmitting(true)

    const { error } = await supabase
      .from('log_entries')
      .update({ involved_parties: selected })
      .eq('id', entryId)

    if (error) {
      toast.error(`Failed to update: ${error.message}`)
      setSubmitting(false)
    } else {
      // Post a system comment
      const addedCount = selected.length - currentInvolved.length
      if (addedCount > 0) {
         await supabase.from('log_comments').insert({
          entry_id: entryId,
          author_id: profile.id,
          body: `📢 GM added team members to this conversation: ${selected.map(s => s.replace('supervisor:', '')).join(', ')}`,
          is_system: true
        })
      }

      toast.success('Team updated successfully')
      setSubmitting(false)
      setOpen(false)
      onUpdated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50">
          <Users className="h-3.5 w-3.5" />
          Involve Team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Involve Management Team</DialogTitle>
          <DialogDescription>
            Select who should be added to this conversation. They will gain access to view and comment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Special Roles */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Special Roles</h4>
              <div className="grid grid-cols-2 gap-2">
                <div 
                  onClick={() => toggle('HR')}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected.includes('HR') ? 'bg-blue-50 border-blue-200' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}
                >
                  <Shield className={`h-4 w-4 ${selected.includes('HR') ? 'text-blue-600' : 'text-zinc-400'}`} />
                  <span className="text-sm font-medium">HR</span>
                </div>
                <div 
                  onClick={() => toggle('System Admin')}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected.includes('System Admin') ? 'bg-purple-50 border-purple-200' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}
                >
                  <UserCog className={`h-4 w-4 ${selected.includes('System Admin') ? 'text-purple-600' : 'text-zinc-400'}`} />
                  <span className="text-sm font-medium">IT / Admin</span>
                </div>
                <div 
                  onClick={() => toggle('All Management')}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors col-span-2 ${selected.includes('All Management') ? 'bg-amber-50 border-amber-200' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}
                >
                  <Building2 className={`h-4 w-4 ${selected.includes('All Management') ? 'text-amber-600' : 'text-zinc-400'}`} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">All Management</span>
                    <span className="text-[10px] text-zinc-500">Share with all department heads</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Departments */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Department Supervisors</h4>
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(DEPT_LABELS).map(([key, label]) => {
                  if (key === 'hr' || key === 'management') return null
                  const val = `supervisor:${key}`
                  return (
                    <div 
                      key={key}
                      onClick={() => toggle(val)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${selected.includes(val) ? 'bg-zinc-50 border-zinc-900' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}
                    >
                      <span className="text-sm">{label} Supervisor</span>
                      <Checkbox checked={selected.includes(val)} readOnly />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button 
            className="bg-[#C41E3A] hover:bg-[#A01830] text-white" 
            onClick={handleUpdate}
            disabled={submitting}
          >
            {submitting ? 'Updating...' : 'Update Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
