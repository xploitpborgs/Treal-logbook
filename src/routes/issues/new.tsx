import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { AlertTriangle, ChevronLeft, ExternalLink, Loader2 } from 'lucide-react'
import { detectShift, departmentLabels, categoryLabels, timeAgo, formatStatus } from '@/lib/formatters'
import { logAudit } from '@/lib/auditLogger'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/issues/new')({
  component: NewIssuePage,
})

const schema = z.object({
  title:    z.string().min(5, 'Title must be at least 5 characters').max(150),
  team:     z.string().min(1, 'Please select a department'),
  shift:    z.string().min(1, 'Please select a shift'),
  category: z.string().min(1, 'Please select a category'),
  priority: z.string().min(1, 'Please select a priority'),
  body:     z.string().min(20, 'Details must be at least 20 characters'),
})

type FormData = z.infer<typeof schema>

const PRIORITY_BUTTONS = [
  { value: 'low',    label: 'Low',    active: 'bg-zinc-600 text-white border-zinc-600' },
  { value: 'medium', label: 'Medium', active: 'bg-blue-500 text-white border-blue-500' },
  { value: 'high',   label: 'High',   active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'urgent', label: 'Urgent', active: 'bg-[#C41E3A] text-white border-[#C41E3A]' },
]

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  incident:        'An unexpected event requiring documentation',
  maintenance:     'Equipment or facility issue',
  guest_complaint: 'A concern raised by a guest',
  handover:        'End of shift notes for the next team',
  general:         'General operational notes',
}

interface SimilarIssue {
  id: string
  title: string
  status: string
  created_at: string
  author: { full_name: string } | null
}

function NewIssuePage() {
  const navigate = useNavigate()
  const { profile, isGM, isHR, isSupervisor, isAdmin } = useRole()

  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([])
  const [dupDismissed, setDupDismissed]   = useState(false)
  const [discardOpen, setDiscardOpen]     = useState(false)

  const canChangeTeam = isSupervisor() || isAdmin()

  // Access control — redirect GM and HR
  useEffect(() => {
    if (profile && (isGM() || isHR())) {
      toast.error('You do not have permission to create issues.')
      navigate({ to: '/dashboard' })
    }
  }, [profile])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:    '',
      team:     '',
      shift:    detectShift(),
      category: '',
      priority: 'low',
      body:     '',
    },
  })

  // Populate team once profile loads
  useEffect(() => {
    if (profile) {
      reset({
        title:    '',
        team:     (profile.team ?? profile.department) as string,
        shift:    detectShift(),
        category: '',
        priority: 'low',
        body:     '',
      })
    }
  }, [profile?.id])

  const title    = watch('title')
  const priority = watch('priority')

  const checkDuplicates = useCallback(async (titleVal: string) => {
    if (titleVal.length < 5 || dupDismissed) return
    const dept = getValues('team')
    const { data } = await supabase
      .from('log_entries')
      .select('id, title, status, created_at, author:profiles!author_id(full_name)')
      .eq('department', dept)
      .neq('status', 'resolved')
      .ilike('title', `%${titleVal}%`)
      .limit(3)
    setSimilarIssues((data as unknown as SimilarIssue[]) ?? [])
  }, [dupDismissed, getValues])

  const handleTitleBlur = () => {
    if (title.length >= 5) checkDuplicates(title)
  }

  const tryLeave = () => {
    if (isDirty) setDiscardOpen(true)
    else navigate({ to: '/dashboard' })
  }

  const onSubmit = async (data: FormData) => {
    if (similarIssues.length > 0 && !dupDismissed) {
      toast.warning('Please review the similar issues above, or dismiss the warning first.')
      return
    }

    const { data: inserted, error } = await supabase
      .from('log_entries')
      .insert({
        author_id:    profile!.id,
        team:         data.team,
        department:   data.team,
        shift:        data.shift,
        category:     data.category,
        priority:     data.priority,
        title:        data.title,
        body:         data.body,
        status:       'open',
        is_escalated: false,
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to log issue. Please try again.')
    } else {
      logAudit({ actorId: profile!.id, action: 'created', entityType: 'log_entry', entityId: inserted.id, note: 'Issue created' })
      toast.success('Issue logged successfully')
      navigate({ to: '/issues/$issueId', params: { issueId: inserted.id } })
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl w-full space-y-6 pb-12">

        {/* Page header */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={tryLeave}
            className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">New Issue</h1>
            <p className="text-sm text-zinc-500">Log a shift event, incident or maintenance note</p>
          </div>
        </div>

        {/* Form card */}
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Title */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-zinc-700">
                    Title <span className="text-[#C41E3A]">*</span>
                  </Label>
                  <span className="text-xs text-zinc-400">{title.length}/150</span>
                </div>
                <Input
                  {...register('title')}
                  placeholder="Brief summary of the issue"
                  maxLength={150}
                  onBlur={handleTitleBlur}
                  className={cn(errors.title && 'border-red-400 focus-visible:ring-red-400')}
                />
                {errors.title && (
                  <p className="text-xs text-red-600">{errors.title.message}</p>
                )}

                {/* Duplicate warning */}
                {similarIssues.length > 0 && !dupDismissed && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <p className="text-sm font-medium text-amber-800">
                        Similar open issues found in your team:
                      </p>
                    </div>
                    <ul className="space-y-2 mb-3">
                      {similarIssues.map(issue => (
                        <li key={issue.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-amber-900 truncate">{issue.title}</p>
                            <p className="text-xs text-amber-600">
                              {formatStatus(issue.status)} · by {issue.author?.full_name ?? 'Unknown'} · {timeAgo(issue.created_at)}
                            </p>
                          </div>
                          <Link to="/issues/$issueId" params={{ issueId: issue.id }}>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-amber-500 hover:text-amber-800" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button" size="sm" variant="outline"
                        className="text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                        onClick={() => navigate({ to: '/issues/$issueId', params: { issueId: similarIssues[0].id } })}
                      >
                        Add Update to Existing
                      </Button>
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="text-xs text-amber-700 hover:bg-amber-100"
                        onClick={() => { setDupDismissed(true); setSimilarIssues([]) }}
                      >
                        Create New Anyway
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">
                  Team / Department <span className="text-[#C41E3A]">*</span>
                </Label>
                <Select
                  value={watch('team')}
                  onValueChange={v => setValue('team', v, { shouldDirty: true, shouldValidate: true })}
                  disabled={!canChangeTeam}
                >
                  <SelectTrigger className={cn(errors.team && 'border-red-400')}>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(departmentLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.team && <p className="text-xs text-red-600">{errors.team.message}</p>}
              </div>

              {/* Shift */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">
                  Shift <span className="text-[#C41E3A]">*</span>
                </Label>
                <Select
                  value={watch('shift')}
                  onValueChange={v => setValue('shift', v, { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger className={cn(errors.shift && 'border-red-400')}>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (6am – 2pm)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (2pm – 10pm)</SelectItem>
                    <SelectItem value="night">Night (10pm – 6am)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.shift && <p className="text-xs text-red-600">{errors.shift.message}</p>}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">
                  Category <span className="text-[#C41E3A]">*</span>
                </Label>
                <Select
                  value={watch('category')}
                  onValueChange={v => setValue('category', v, { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger className={cn(errors.category && 'border-red-400')}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        <div className="flex flex-col">
                          <span className="font-medium">{l}</span>
                          <span className="text-xs text-zinc-400">{CATEGORY_DESCRIPTIONS[v]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
              </div>

              {/* Priority toggle */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">
                  Priority <span className="text-[#C41E3A]">*</span>
                </Label>
                <div className="flex gap-2">
                  {PRIORITY_BUTTONS.map(btn => (
                    <button
                      key={btn.value}
                      type="button"
                      onClick={() => setValue('priority', btn.value, { shouldDirty: true })}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                        priority === btn.value
                          ? btn.active
                          : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {priority === 'urgent' && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      ⚠️ Urgent issues will immediately notify all supervisors and the GM via email.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-zinc-700">
                    Details <span className="text-[#C41E3A]">*</span>
                  </Label>
                  <span className="text-xs text-zinc-400">{watch('body').length} chars</span>
                </div>
                <Textarea
                  {...register('body')}
                  placeholder="Provide full details. Include room numbers, guest names, actions taken and any follow-up required."
                  className={cn('min-h-[160px]', errors.body && 'border-red-400 focus-visible:ring-red-400')}
                  rows={6}
                />
                {errors.body && <p className="text-xs text-red-600">{errors.body.message}</p>}
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-zinc-100">
                <Button type="button" variant="ghost" className="text-zinc-600" onClick={tryLeave}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#C41E3A] hover:bg-[#a01830] text-white"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Logging…
                    </span>
                  ) : 'Log Issue'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Unsaved changes dialog */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard issue?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => navigate({ to: '/dashboard' })}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
