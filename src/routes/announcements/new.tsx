/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import type { Profile } from '@/types'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { gmCategoryLabels, hrCategoryLabels, supervisorCategoryLabels, staffCategoryLabels, departmentLabels } from '@/lib/formatters'
import { logAudit } from '@/lib/auditLogger'
import { notifyManagement, notifyDepartment, createNotification } from '@/lib/notifications'
import { Info } from 'lucide-react'

export const Route = createFileRoute('/announcements/new')({
  component: UnifiedAnnouncementNew,
})

const schema = z.object({
  type:             z.enum(['gm', 'hr', 'department', 'staff']),
  department:       z.string().optional(),
  target_staff_id:  z.string().optional(),
  title:            z.string().min(5, 'Title must be at least 5 characters').max(150),
  category:         z.string().min(1, 'Please select a category'),
  priority:         z.string().min(1, 'Please select a priority'),
  body:             z.string().min(20, 'Details must be at least 20 characters'),
  is_pinned:        z.boolean(),
})

type FormData = z.infer<typeof schema>

function UnifiedAnnouncementNew() {
  const navigate = useNavigate()
  const { profile, isAdmin, isGM, isHR, isSupervisor } = useRole()
  const [discardOpen, setDiscardOpen] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: isAdmin() ? 'gm' : isGM() ? 'gm' : isHR() ? 'hr' : 'department',
      department: profile?.department ?? '',
      target_staff_id: 'all',
      title: '',
      category: 'general',
      priority: 'medium',
      body: '',
      is_pinned: false,
    },
  })

  const [staffList, setStaffList] = useState<Profile[]>([])

  useEffect(() => {
    async function fetchStaff() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['staff', 'supervisor', 'hr', 'gm'])
        .eq('is_active', true)
        .order('full_name')
      if (data) setStaffList(data)
    }
    fetchStaff()
  }, [])

  const { formState: { isDirty, isSubmitting }, watch, setValue } = form
  const typeValue = watch('type')
  const titleLen = watch('title').length
  const bodyLen = watch('body').length

  // Access control
  useEffect(() => {
    if (profile && !isAdmin() && !isGM() && !isHR() && !isSupervisor()) {
      toast.error('You do not have permission to post announcements.')
      navigate({ to: '/dashboard' })
    }
  }, [profile])

  function tryLeave() {
    if (isDirty) setDiscardOpen(true)
    else navigate({ to: '/dashboard' })
  }

  async function onSubmit(values: FormData) {
    if (!profile) return

    let table = ''
    let payload: any = {
      author_id: profile.id,
      title: values.title.trim(),
      body: values.body.trim(),
      priority: values.priority,
      category: values.category,
    }

    if (values.type === 'gm') {
      table = 'gm_updates'
    } else if (values.type === 'hr') {
      table = 'hr_updates'
      payload.is_pinned = values.is_pinned
    } else if (values.type === 'department') {
      table = 'supervisor_updates'
      payload.team = values.department || profile.department
      payload.department = values.department || profile.department
    } else {
      table = 'staff_updates'
      if (values.target_staff_id !== 'all') {
        payload.target_staff_id = values.target_staff_id
      } else {
        payload.department = values.department || profile.department
      }
    }

    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single()

    if (error || !data) {
      toast.error(`Failed to post ${values.type.toUpperCase()} update: ${error?.message || 'Unknown error'}`)
      return
    }

    await logAudit({
      actorId: profile.id,
      action: 'created',
      entityType: values.type === 'hr' ? 'hr_update' : values.type === 'gm' ? 'gm_update' : values.type === 'department' ? 'supervisor_update' : 'staff_update',
      entityId: data.id,
      note: `Unified announcement posted as ${values.type}`,
    })

    // Trigger Notifications
    if (values.type === 'gm' || values.type === 'hr') {
      await notifyManagement({
        title: values.type === 'gm' ? 'New GM Directive' : 'New HR Announcement',
        message: `${profile.full_name}: ${values.title}`,
        type: 'directive',
        link: '/dashboard',
        priority: values.priority as any
      })
    } else if (values.type === 'department') {
      await notifyDepartment({
        department: values.department || profile.department,
        title: 'Department Update',
        message: `${profile.full_name}: ${values.title}`,
        type: 'directive',
        link: '/dashboard',
        priority: values.priority as any
      })
    } else if (values.type === 'staff') {
      if (values.target_staff_id === 'all') {
        await notifyDepartment({
          department: values.department || profile.department,
          title: 'Team Update',
          message: `${profile.full_name}: ${values.title}`,
          type: 'directive',
          link: '/dashboard',
          priority: values.priority as any
        })
      } else {
        await createNotification({
          userId: values.target_staff_id!,
          title: 'Direct Message',
          message: `${profile.full_name}: ${values.title}`,
          type: 'directive',
          link: '/dashboard',
          priority: values.priority as any
        })
      }
    }

    toast.success('Announcement posted successfully')
    navigate({ to: '/dashboard' })
  }

  const categoryOptions = typeValue === 'gm'
    ? gmCategoryLabels
    : typeValue === 'hr'
      ? hrCategoryLabels
      : typeValue === 'staff'
        ? staffCategoryLabels
        : supervisorCategoryLabels

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl w-full pb-12">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">Post Announcement</h1>
          <p className="text-sm text-muted-foreground">
            {typeValue === 'gm' && 'Issue directives and announcements to supervisors and management.'}
            {typeValue === 'hr' && 'Broadcast HR communications to supervisors and management.'}
            {typeValue === 'department' && 'Share operational updates with your team or management.'}
          </p>
        </div>

        <Separator className="mb-8" />

        {/* Visibility notice */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            {typeValue === 'gm' && 'ℹ️ This directive will be visible to the General Manager, all supervisors and management.'}
            {typeValue === 'hr' && 'ℹ️ This announcement will be visible to HR, all supervisors and management.'}
            {typeValue === 'department' && (
              <>
                ℹ️ This update will be visible to the{' '}
                <span className="font-semibold">
                  {departmentLabels[watch('department') as keyof typeof departmentLabels] ?? 'selected department'}
                </span>.
              </>
            )}
            {typeValue === 'staff' && (
              <>
                ℹ️ This update will be visible to{' '}
                <span className="font-semibold">
                  {watch('target_staff_id') === 'all' 
                    ? `all personnel in ${departmentLabels[watch('department') as keyof typeof departmentLabels] ?? 'the selected department'}` 
                    : staffList.find(s => s.id === watch('target_staff_id'))?.full_name ?? 'the selected person'}
                </span>.
              </>
            )}
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Announcement Type (Only for Admin & GM) */}
            {(isAdmin() || isGM()) && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Announcement Target</FormLabel>
                    <Select onValueChange={(v) => {
                      field.onChange(v)
                      setValue('category', 'general')
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gm">GM (General Manager Directive)</SelectItem>
                        <SelectItem value="hr">HR (Human Resources update)</SelectItem>
                        <SelectItem value="department">Supervisors / Managers</SelectItem>
                        <SelectItem value="staff">Staff Members</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Department / Staff selection */}
            {(typeValue === 'department' || typeValue === 'staff') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Department</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {typeValue === 'staff' && (
                  <FormField
                    control={form.control}
                    name="target_staff_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specific Staff Member</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Staff in Department</SelectItem>
                            {staffList
                              .filter(s => !watch('department') || s.department === watch('department'))
                              .map(staff => (
                                <SelectItem key={staff.id} value={staff.id}>{staff.full_name}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

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
                    <Input placeholder="Brief summary of the announcement..." maxLength={150} {...field} />
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
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryOptions).map(([v, l]) => (
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
                        <SelectTrigger>
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
                      placeholder="Provide full details. Be clear and specific about any actions required."
                      className="min-h-[160px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pin toggle (Only for HR) */}
            {typeValue === 'hr' && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-900">Pin this update</p>
                  <p className="text-xs text-muted-foreground">Pinned updates appear at the top of all feeds</p>
                </div>
                <Controller
                  name="is_pinned"
                  control={form.control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            )}

            <Separator />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={tryLeave} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#C41E3A] hover:bg-[#a01830] text-white">
                {isSubmitting ? 'Posting…' : `Post ${typeValue.toUpperCase()} Announcement`}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard announcement?</AlertDialogTitle>
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
