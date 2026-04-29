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
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/entries/new')({
  component: NewEntryPage,
})

function NewEntryPage() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [department, setDepartment] = useState<string>('')
  const [shift, setShift] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (profile?.department && !department) {
      setDepartment(profile.department)
    }
    if (!shift) {
      const hour = new Date().getHours()
      if (hour >= 6 && hour < 14) setShift('morning')
      else if (hour >= 14 && hour < 22) setShift('afternoon')
      else setShift('night')
    }
  }, [profile, department, shift])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !body.trim() || !department || !shift || !category || !priority) {
      toast.error('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase
      .from('log_entries')
      .insert([{
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
      toast.error(`Failed to create log entry: ${error.message || error.details || 'Unknown error'}`)
      console.error(error)
    } else {
      toast.success('Log entry created successfully')
      navigate({ to: '/dashboard' })
    }
  }

  return (
    <AppLayout title="New Log Entry">
      <div className="flex flex-col max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="hidden sm:flex items-center justify-between">
            <p className="text-sm text-zinc-500">Record an update for your shift</p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="h-9 rounded-md border-zinc-200 text-sm font-medium text-zinc-700">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Form Card */}
        <Card className="rounded-lg border border-zinc-200 bg-white shadow-none">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-zinc-700">
                  Title <span className="text-[#a31e22]">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Brief summary of the issue or update"
                  className="border-zinc-200 focus-visible:ring-zinc-400"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="body" className="text-sm font-medium text-zinc-700">
                  Description <span className="text-[#a31e22]">*</span>
                </Label>
                <Textarea
                  id="body"
                  placeholder="Provide more details..."
                  className="min-h-[120px] border-zinc-200 focus-visible:ring-zinc-400"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>

              {/* Grid for Selects */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Department */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Department <span className="text-[#a31e22]">*</span>
                  </Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="border-zinc-200 focus:ring-zinc-400">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
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

                {/* Shift */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Shift <span className="text-[#a31e22]">*</span>
                  </Label>
                  <Select value={shift} onValueChange={setShift}>
                    <SelectTrigger className="border-zinc-200 focus:ring-zinc-400">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Category <span className="text-[#a31e22]">*</span>
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="border-zinc-200 focus:ring-zinc-400">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incident">Incident</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="guest_complaint">Guest Complaint</SelectItem>
                      <SelectItem value="handover">Handover</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-700">
                    Priority <span className="text-[#a31e22]">*</span>
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="border-zinc-200 focus:ring-zinc-400">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Urgent warning */}
              {priority === 'urgent' && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    Urgent entries immediately notify all Supervisors and the GM via email.
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row">
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#a31e22] text-white hover:bg-[#82181b] sm:w-auto"
                >
                  {isSubmitting ? 'Submitting...' : 'Create Entry'}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
