/* eslint-disable react-refresh/only-export-components */
import { useEffect, useCallback, useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { detectShift, departmentLabels, categoryLabels, timeAgo, formatStatus } from '@/lib/formatters'
import { logAudit } from '@/lib/auditLogger'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

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

interface SimilarIssue {
  id: string
  title: string
  status: string
  created_at: string
  author: { full_name: string } | null
}

function NewIssuePage() {
  const navigate    = useNavigate()
  const { profile, isGM, isHR, isAdmin } = useRole()
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([])
  const [dupDismissed, setDupDismissed]   = useState(false)


  useEffect(() => {
    if (profile && (isGM() || isHR())) {
      toast.error('You do not have permission to create issues.')
      navigate({ to: '/dashboard' })
    }
  }, [profile])

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:    '',
      team:     '',
      shift:    detectShift(),
      category: '',
      priority: 'medium',
      body:     '',
    },
  })

  useEffect(() => {
    if (profile) {
      form.reset({
        title:    '',
        team:     (profile.team ?? profile.department) as string,
        shift:    detectShift(),
        category: '',
        priority: 'medium',
        body:     '',
      })
    }
  }, [profile?.id])

  const checkDuplicates = useCallback(async (titleVal: string) => {
    if (titleVal.length < 5 || dupDismissed) return
    const dept = form.getValues('team')
    const { data } = await supabase
      .from('log_entries')
      .select('id, title, status, created_at, author:profiles!author_id(full_name)')
      .eq('department', dept)
      .neq('status', 'resolved')
      .ilike('title', `%${titleVal}%`)
      .limit(3)
    setSimilarIssues((data as unknown as SimilarIssue[]) ?? [])
  }, [dupDismissed])

  const onSubmit = async (data: FormData) => {
    if (similarIssues.length > 0 && !dupDismissed) {
      toast.warning('Please review the similar issues below, or dismiss the warning first.')
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
      <div className="mx-auto max-w-xl w-full pb-12">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">New Issue</h1>
          <p className="text-sm text-muted-foreground">
            Log a shift event, incident or maintenance note.
          </p>
        </div>

        <Separator className="mb-8" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Title</FormLabel>
                    <span className="text-xs text-muted-foreground">{field.value.length}/150</span>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="Brief summary of the issue"
                      maxLength={150}
                      {...field}
                      onBlur={() => { field.onBlur(); checkDuplicates(field.value) }}
                    />
                  </FormControl>
                  <FormMessage />

                  {/* Duplicate warning */}
                  {similarIssues.length > 0 && !dupDismissed && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <p className="text-xs font-medium text-amber-800">Similar open issues found in your team:</p>
                      </div>
                      <ul className="space-y-1.5">
                        {similarIssues.map(issue => (
                          <li key={issue.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-amber-900 truncate">{issue.title}</p>
                              <p className="text-xs text-amber-600">
                                {formatStatus(issue.status)} · {timeAgo(issue.created_at)}
                              </p>
                            </div>
                            <Link to="/issues/$issueId" params={{ issueId: issue.id }}>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-amber-500 hover:text-amber-800" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2 pt-0.5">
                        <Button type="button" size="sm" variant="outline"
                          className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => navigate({ to: '/issues/$issueId', params: { issueId: similarIssues[0].id } })}
                        >
                          View Existing
                        </Button>
                        <Button type="button" size="sm" variant="ghost"
                          className="h-7 text-xs text-amber-700 hover:bg-amber-100"
                          onClick={() => { setDupDismissed(true); setSimilarIssues([]) }}
                        >
                          Create Anyway
                        </Button>
                      </div>
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Team */}
            <FormField
              control={form.control}
              name="team"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team / Department</FormLabel>
                  {isAdmin() ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(departmentLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {departmentLabels[field.value as keyof typeof departmentLabels] ?? field.value}
                      <input type="hidden" {...field} />
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Shift · Category · Priority */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">

              <FormField
                control={form.control}
                name="shift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Shift" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="morning">Morning (6am – 2pm)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (2pm – 10pm)</SelectItem>
                        <SelectItem value="night">Night (10pm – 6am)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {field.value === 'urgent' && (
                      <p className="text-xs text-amber-700 flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Urgent issues notify all supervisors and the GM immediately.
                      </p>
                    )}
                  </FormItem>
                )}
              />

            </div>

            {/* Details */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Details</FormLabel>
                    <span className="text-xs text-muted-foreground">{field.value.length} chars</span>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Provide full details. Include room numbers, guest names, actions taken and any follow-up required."
                      className="min-h-[160px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/dashboard' })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-[#C41E3A] hover:bg-[#a01830] text-white"
              >
                {form.formState.isSubmitting ? 'Submitting…' : 'Log Issue'}
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </AppLayout>
  )
}
