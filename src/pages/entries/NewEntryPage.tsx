import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AlertTriangle, ChevronLeft, Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Link } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { currentShift } from '@/lib/format'
import { DEPT_LABELS, SHIFT_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { Department, Shift, Category, Priority } from '@/types'

interface FormValues {
  title: string
  department: Department
  shift: Shift
  category: Category
  priority: Priority
  body: string
}

interface SimilarIssue {
  id: string
  title: string
  created_at: string
}

const CATEGORY_OPTIONS: { value: Category; label: string; description: string }[] = [
  { value: 'incident', label: 'Incident', description: 'An unexpected event requiring documentation' },
  { value: 'maintenance', label: 'Maintenance', description: 'Equipment or facility issue' },
  { value: 'guest_complaint', label: 'Guest Complaint', description: 'A concern raised by a guest' },
  { value: 'handover', label: 'Handover', description: 'End of shift notes for the next team' },
  { value: 'general', label: 'General', description: 'General operational notes' },
]

const PRIORITY_STYLES: Record<Priority, { selected: string; unselected: string }> = {
  low: {
    selected: 'bg-zinc-600 text-white border-zinc-600',
    unselected: 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400',
  },
  medium: {
    selected: 'bg-blue-500 text-white border-blue-500',
    unselected: 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400',
  },
  high: {
    selected: 'bg-amber-500 text-white border-amber-500',
    unselected: 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400',
  },
  urgent: {
    selected: 'bg-[#a31e22] text-white border-[#a31e22]',
    unselected: 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400',
  },
}

export function NewEntryPage() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([])

  const form = useForm<FormValues>({
    defaultValues: {
      title: '',
      department: profile?.department ?? 'front_desk',
      shift: currentShift(),
      category: 'general',
      priority: 'low',
      body: '',
    },
  })

  const { watch, formState: { isDirty, isSubmitting } } = form
  const titleValue = watch('title')
  const bodyValue = watch('body')
  const selectedCategory = watch('category')
  const categoryDescription = CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.description

  useEffect(() => {
    if (!titleValue || titleValue.length < 5 || !profile) {
      setSimilarIssues([])
      return
    }

    const timer = setTimeout(async () => {

      const { data } = await supabase
        .from('log_entries')
        .select('id, title, created_at')
        .eq('department', profile.department)
        .in('status', ['open', 'in_progress'])
        .ilike('title', `%${titleValue}%`)
        .limit(3)

      if (data) setSimilarIssues(data)

    }, 500)

    return () => clearTimeout(timer)
  }, [titleValue, profile])

  function tryNavigate(to: string) {
    if (isDirty) {
      setPendingNav(to)
      setDiscardOpen(true)
    } else {
      navigate({ to: to as '/dashboard' })
    }
  }

  async function onSubmit(values: FormValues) {
    if (!profile) return

    const { data, error } = await supabase
      .from('log_entries')
      .insert({
        author_id: profile.id,
        department: values.department,
        shift: values.shift,
        category: values.category,
        priority: values.priority,
        title: values.title,
        body: values.body,
        status: 'open',
      })
      .select('id')
      .single()

    if (error || !data) {
      toast.error('Failed to submit entry. Please try again.')
      return
    }

    toast.success('Entry logged successfully')
    // @ts-expect-error - Route inference bug in IDE
    navigate({ to: '/entries/$id', params: { id: data.id } })
  }

  return (
    <>
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => tryNavigate('/dashboard')}
            className="mb-4 inline-flex items-center text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </button>
          <h1 className="text-xl font-semibold text-zinc-900">New Log Entry</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Log a shift event, incident, handover or maintenance note
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-lg border border-[#e4e4e7] bg-white p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                rules={{
                  required: 'Title is required',
                  minLength: { value: 5, message: 'Title must be at least 5 characters' },
                  maxLength: { value: 150, message: 'Title must be 150 characters or fewer' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief summary of the issue..." maxLength={150} {...field} />
                    </FormControl>

                    {similarIssues.length > 0 && (
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-900">
                              Similar open issues found in your department
                            </p>
                            <p className="mt-1 text-sm text-amber-700">
                              To avoid duplicates, please consider adding an update to an existing issue instead of creating a new one.
                            </p>
                            <div className="mt-3 flex flex-col gap-2">
                              {similarIssues.map(issue => (
                                <Link
                                  key={issue.id}
                                  to="/entries/$id"
                                  // @ts-expect-error - Route inference bug in IDE
                                  params={{ id: issue.id }}
                                  className="flex items-center gap-2 text-sm text-[#a31e22] hover:underline"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {issue.title}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <FormMessage />
                      <span className="ml-auto text-xs text-zinc-400">
                        {titleValue.length} / 150
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              {/* Department */}
              <FormField
                control={form.control}
                name="department"
                rules={{ required: 'Please select a department' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(DEPT_LABELS) as [Department, string][]).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Shift */}
              <FormField
                control={form.control}
                name="shift"
                rules={{ required: 'Please select a shift' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Shift</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(SHIFT_LABELS) as [Shift, string][]).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                rules={{ required: 'Please select a category' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoryDescription && (
                      <p className="text-xs text-zinc-400">{categoryDescription}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority toggle buttons */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <div className="flex gap-2">
                      {(Object.keys(PRIORITY_LABELS) as Priority[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => field.onChange(p)}
                          className={cn(
                            'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                            field.value === p
                              ? PRIORITY_STYLES[p].selected
                              : PRIORITY_STYLES[p].unselected,
                          )}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Body */}
              <FormField
                control={form.control}
                name="body"
                rules={{
                  required: 'Details are required',
                  minLength: { value: 20, message: 'Please provide at least 20 characters of detail' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide full details of the entry. Include room numbers, guest names, actions taken, and any follow-up required."
                        className="min-h-[160px] resize-y"
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between">
                      <FormMessage />
                      <span className="ml-auto text-xs text-zinc-400">{bodyValue.length} chars</span>
                    </div>
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => tryNavigate('/dashboard')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#a31e22] text-white hover:bg-[#82181b]"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Submitting…' : 'Submit Entry'}
                </Button>
              </div>

            </form>
          </Form>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard entry?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#a31e22] text-white hover:bg-[#82181b]"
              onClick={() => {
                setDiscardOpen(false)
                if (pendingNav) navigate({ to: pendingNav as '/dashboard' })
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
