/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { Button } from '@/components/ui/button'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { hrCategoryLabels } from '@/lib/formatters'
import { logAudit } from '@/lib/auditLogger'

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

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', category: '', priority: 'medium', body: '', is_pinned: false },
  })

  const { formState: { isDirty, isSubmitting }, control } = form
  const titleLen = form.watch('title').length
  const bodyLen  = form.watch('body').length

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
      <div className="mx-auto max-w-xl w-full pb-12">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">Post HR Update</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast HR communications to supervisors and management.
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
                    <span className="text-xs text-muted-foreground">{titleLen}/150</span>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="e.g. Updated Leave Policy — Effective May 2026"
                      maxLength={150}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category · Priority */}
            <div className="grid grid-cols-2 gap-4">
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
                        {Object.entries(hrCategoryLabels).map(([v, l]) => (
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
                    <span className="text-xs text-muted-foreground">{bodyLen} chars</span>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Provide full details of the HR update. Include effective dates, affected staff, and any required actions."
                      className="min-h-[160px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pin toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">Pin this update</p>
                <p className="text-xs text-muted-foreground">Pinned updates appear at the top of all feeds</p>
              </div>
              <Controller
                name="is_pinned"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            <Separator />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={tryLeave} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#C41E3A] hover:bg-[#a01830] text-white">
                {isSubmitting ? 'Posting…' : 'Post HR Update'}
              </Button>
            </div>

          </form>
        </Form>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard update?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Are you sure you want to leave?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => navigate({ to: '/dashboard' })}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
