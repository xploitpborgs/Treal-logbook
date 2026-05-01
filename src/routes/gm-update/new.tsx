import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/auditLogger'
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
import { ChevronLeft, Loader2, Megaphone, TriangleAlert } from 'lucide-react'
import { gmCategoryLabels } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/gm-update/new')({
  component: GMUpdateNew,
})

const schema = z.object({
  title:    z.string().min(5, 'Title must be at least 5 characters').max(150),
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
  directive:    'A direct instruction to supervisors',
  policy:       'A policy change or update',
  announcement: 'A general management announcement',
  performance:  'Performance standards or feedback',
  general:      'General management communication',
}

function GMUpdateNew() {
  const navigate    = useNavigate()
  const { profile, isGM, isAdmin } = useRole()
  const [discardOpen, setDiscardOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:    '',
      category: '',
      priority: 'low',
      body:     '',
    },
  })

  const priority = watch('priority')
  const title    = watch('title')
  const body     = watch('body')

  // Access guard
  if (!isGM() && !isAdmin()) {
    toast.error('Only the General Manager can post GM updates.')
    navigate({ to: '/dashboard' })
    return null
  }

  function tryLeave() {
    if (isDirty) setDiscardOpen(true)
    else navigate({ to: '/dashboard' })
  }

  async function onSubmit(values: FormData) {
    if (!profile) return

    const { data, error } = await supabase
      .from('gm_updates')
      .insert({
        author_id: profile.id,
        title:     values.title.trim(),
        body:      values.body.trim(),
        priority:  values.priority,
        category:  values.category,
      })
      .select()
      .single()

    if (error || !data) {
      toast.error('Failed to post GM update. Please try again.')
      return
    }

    await logAudit({
      actorId:    profile.id,
      action:     'created',
      entityType: 'gm_update',
      entityId:   data.id,
      note:       'GM update posted',
    })

    toast.success('GM update posted successfully')
    navigate({ to: '/dashboard' })
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
            <h1 className="text-xl font-semibold text-zinc-900">Post GM Update</h1>
            <p className="text-sm text-zinc-500">Issue directives and announcements to supervisors and management</p>
          </div>
        </div>

        {/* Visibility notice */}
        <Alert className="border-amber-200 bg-amber-50">
          <Megaphone className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 text-sm">
            This update will be visible to all Supervisors, HR and System Admin. Staff will <strong>NOT</strong> see this update.
          </AlertDescription>
        </Alert>

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
                  placeholder="e.g. Updated Check-in Procedures — Effective Immediately"
                  maxLength={150}
                  className={cn(errors.title && 'border-red-400 focus-visible:ring-red-400')}
                />
                {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
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
                    {Object.entries(gmCategoryLabels).map(([v, l]) => (
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

              {/* Priority */}
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
                  <Alert className="border-amber-200 bg-amber-50 mt-2">
                    <TriangleAlert className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-xs">
                      Urgent GM updates will immediately notify all supervisors and HR via email.
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
                  <span className="text-xs text-zinc-400">{body.length} chars</span>
                </div>
                <Textarea
                  {...register('body')}
                  placeholder="Provide full details of the directive or announcement. Be clear and specific about any actions required."
                  className={cn('min-h-[160px]', errors.body && 'border-red-400 focus-visible:ring-red-400')}
                  rows={6}
                />
                {errors.body && <p className="text-xs text-red-600">{errors.body.message}</p>}
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-zinc-600"
                  disabled={isSubmitting}
                  onClick={tryLeave}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#C41E3A] hover:bg-[#a01830] text-white"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Posting…
                    </span>
                  ) : 'Post GM Update'}
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
            <AlertDialogTitle>Discard update?</AlertDialogTitle>
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
