/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/auditLogger'
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { gmCategoryLabels } from '@/lib/formatters'

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

function GMUpdateNew() {
  const navigate = useNavigate()
  const { profile, isGM, isAdmin } = useRole()
  const [discardOpen, setDiscardOpen] = useState(false)

  if (!isGM() && !isAdmin()) {
    toast.error('Only the General Manager can post GM updates.')
    navigate({ to: '/dashboard' })
    return null
  }

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', category: '', priority: 'medium', body: '' },
  })

  const { formState: { isDirty, isSubmitting } } = form
  const titleLen = form.watch('title').length
  const bodyLen  = form.watch('body').length

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
    await logAudit({ actorId: profile.id, action: 'created', entityType: 'gm_update', entityId: data.id, note: 'GM update posted' })
    toast.success('GM update posted successfully')
    navigate({ to: '/dashboard' })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl w-full pb-12">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">Post GM Update</h1>
          <p className="text-sm text-muted-foreground">
            Issue directives and announcements to supervisors and management.
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
                      placeholder="e.g. Updated Check-in Procedures — Effective Immediately"
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
                        {Object.entries(gmCategoryLabels).map(([v, l]) => (
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
                      placeholder="Provide full details of the directive or announcement. Be clear and specific about any actions required."
                      className="min-h-[160px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={tryLeave} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#C41E3A] hover:bg-[#a01830] text-white">
                {isSubmitting ? 'Posting…' : 'Post GM Update'}
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
