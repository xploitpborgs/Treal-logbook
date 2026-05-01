import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
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
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Megaphone } from 'lucide-react'
import { hrCategoryLabels } from '@/lib/formatters'
import { logAudit } from '@/lib/auditLogger'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/hr-update/new')({
  component: HRUpdateNew,
})

const schema = z.object({
  title:     z.string().min(5, 'Title must be at least 5 characters').max(150),
  category:  z.string().min(1, 'Please select a category'),
  priority:  z.string().min(1, 'Please select a priority'),
  body:      z.string().min(20, 'Details must be at least 20 characters'),
  is_pinned: z.boolean(),
})

type FormData = z.infer<typeof schema>

const PRIORITY_BUTTONS = [
  { value: 'low',    label: 'Low',    active: 'bg-zinc-600 text-white border-zinc-600' },
  { value: 'medium', label: 'Medium', active: 'bg-blue-500 text-white border-blue-500' },
  { value: 'high',   label: 'High',   active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'urgent', label: 'Urgent', active: 'bg-[#C41E3A] text-white border-[#C41E3A]' },
]

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  policy:        'Policy changes or updates',
  announcement:  'General company announcements',
  training:      'Training schedules or requirements',
  disciplinary:  'Disciplinary procedures or notices',
  general:       'General HR communications',
}

function HRUpdateNew() {
  const navigate = useNavigate()
  const { profile, isHR, isAdmin } = useRole()
  const [discardOpen, setDiscardOpen] = useState(false)

  useEffect(() => {
    if (profile && !isHR() && !isAdmin()) {
      toast.error('Only HR can post HR updates.')
      navigate({ to: '/dashboard' })
    }
  }, [profile])

  const {
    register, handleSubmit, watch, setValue, control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', category: '', priority: 'low', body: '', is_pinned: false },
  })

  const title    = watch('title')
  const priority = watch('priority')

  const tryLeave = () => {
    if (isDirty) setDiscardOpen(true)
    else navigate({ to: '/dashboard' })
  }

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.from('hr_updates').insert({
      author_id: profile!.id,
      title:     data.title,
      body:      data.body,
      priority:  data.priority,
      category:  data.category,
      is_pinned: data.is_pinned,
    })
    if (error) {
      toast.error('Failed to post HR update. Please try again.')
    } else {
      logAudit({ actorId: profile!.id, action: 'created', entityType: 'hr_update', entityId: profile!.id, note: 'HR update posted' })
      toast.success('HR update posted successfully')
      navigate({ to: '/dashboard' })
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl w-full space-y-6 pb-12">

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
            <h1 className="text-xl font-semibold text-zinc-900">Post HR Update</h1>
            <p className="text-sm text-zinc-500">Broadcast HR communications to supervisors and management</p>
          </div>
        </div>

        <Alert className="border-purple-200 bg-purple-50">
          <Megaphone className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-800">
            📢 This update will be visible to all supervisors, the General Manager and System Admin. Staff will <strong>NOT</strong> see this update.
          </AlertDescription>
        </Alert>

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
                  placeholder="e.g. Updated Leave Policy — Effective May 2026"
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
                    {Object.entries(hrCategoryLabels).map(([v, l]) => (
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
                        priority === btn.value ? btn.active : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
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
                  placeholder="Provide full details of the HR update..."
                  className={cn('min-h-[160px]', errors.body && 'border-red-400 focus-visible:ring-red-400')}
                  rows={6}
                />
                {errors.body && <p className="text-xs text-red-600">{errors.body.message}</p>}
              </div>

              {/* Pin toggle */}
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
                <div>
                  <p className="text-sm font-medium text-zinc-700">Pin this update</p>
                  <p className="text-xs text-zinc-400">Pinned updates appear at the top of all feeds</p>
                </div>
                <Controller
                  name="is_pinned"
                  control={control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={v => field.onChange(v)} />
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-zinc-100">
                <Button type="button" variant="ghost" className="text-zinc-600" onClick={tryLeave}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#C41E3A] hover:bg-[#a01830] text-white">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Posting…
                    </span>
                  ) : 'Post Update'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard update?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Are you sure you want to leave?</AlertDialogDescription>
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
