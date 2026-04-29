import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuthContext } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { detectShift } from '@/lib/formatters'

export const Route = createFileRoute('/issues/new')({
  component: NewIssuePage,
})

function NewIssuePage() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [department, setDepartment] = useState<string>('')
  const [shift, setShift]           = useState<string>('')
  const [category, setCategory]     = useState<string>('')
  const [priority, setPriority]     = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (profile?.department && !department) setDepartment(profile.department)
    if (!shift) setShift(detectShift())
  }, [profile, department, shift])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !department || !shift || !category || !priority) {
      toast.error('Please fill in all required fields.')
      return
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('log_entries').insert([{
      title,
      body,
      department,
      shift,
      category,
      priority,
      status: 'open',
      author_id: profile?.id,
    }])
    setIsSubmitting(false)
    if (error) {
      toast.error(`Failed to create issue: ${error.message || 'Unknown error'}`)
    } else {
      toast.success('Issue logged successfully')
      navigate({ to: '/dashboard' })
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col max-w-3xl mx-auto w-full">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500 hidden sm:block">Record an update for your shift</p>
          <Link to="/dashboard">
            <Button variant="outline" className="h-9 text-sm font-medium text-zinc-700">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card className="rounded-lg border border-zinc-200 bg-white shadow-none">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-zinc-700">
                  Title <span className="text-[#C41E3A]">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Brief summary of the issue or update"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body" className="text-sm font-medium text-zinc-700">
                  Description <span className="text-[#C41E3A]">*</span>
                </Label>
                <Textarea
                  id="body"
                  placeholder="Provide more details..."
                  className="min-h-[120px]"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Department <span className="text-[#C41E3A]">*</span>
                  </Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="front_desk">Front Desk</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Shift <span className="text-[#C41E3A]">*</span>
                  </Label>
                  <Select value={shift} onValueChange={setShift}>
                    <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Category <span className="text-[#C41E3A]">*</span>
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incident">Incident</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="guest_complaint">Guest Complaint</SelectItem>
                      <SelectItem value="handover">Handover</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Priority <span className="text-[#C41E3A]">*</span>
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {priority === 'urgent' && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    Urgent issues immediately notify all Supervisors and the GM via email.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row">
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full text-zinc-700">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#C41E3A] text-white hover:bg-[#a31e22] sm:w-auto"
                >
                  {isSubmitting ? 'Submitting...' : 'Log Issue'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
