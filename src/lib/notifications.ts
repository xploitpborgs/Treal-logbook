import { supabase } from './supabase'
import type { NotificationType, Priority } from '@/types'

export async function createNotification(params: {
  userId: string
  title: string
  message: string
  type: NotificationType
  link?: string
  priority?: Priority
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
    priority: params.priority || 'medium'
  })

  if (error) {
    console.error('Error creating notification:', error.message)
    return { success: false, error }
  }

  return { success: true }
}

/**
 * Convenience helper to notify a whole department
 */
export async function notifyDepartment(params: {
  department: string
  title: string
  message: string
  type: NotificationType
  link?: string
  priority?: Priority
}) {
  // 1. Find all active staff in that department
  const { data: staff, error: staffError } = await supabase
    .from('profiles')
    .select('id')
    .eq('department', params.department)
    .eq('is_active', true)

  if (staffError) {
    console.error('Error fetching staff for department notification:', staffError.message)
    return { success: false, error: staffError }
  }

  if (!staff || staff.length === 0) return { success: true }

  // 2. Batch insert notifications
  const notifications = staff.map(s => ({
    user_id: s.id,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
    priority: params.priority || 'medium'
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) {
    console.error('Error batch creating notifications:', error.message)
    return { success: false, error }
  }

  return { success: true }
}

/**
 * Notify all Management (GM, HR, Admin)
 */
export async function notifyManagement(params: {
  title: string
  message: string
  type: NotificationType
  link?: string
  priority?: Priority
}) {
  const { data: managers, error: managerError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['gm', 'hr', 'system_admin'])
    .eq('is_active', true)

  if (managerError) {
    console.error('Error fetching managers for notification:', managerError.message)
    return { success: false, error: managerError }
  }

  if (!managers || managers.length === 0) return { success: true }

  const notifications = managers.map(m => ({
    user_id: m.id,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
    priority: params.priority || 'high'
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) {
    console.error('Error batch creating notifications for management:', error.message)
    return { success: false, error }
  }

  return { success: true }
}

/**
 * Notify all users of a specific role
 */
export async function notifyRole(params: {
  role: string | string[]
  title: string
  message: string
  type: NotificationType
  link?: string
  priority?: Priority
}) {
  const roles = Array.isArray(params.role) ? params.role : [params.role]
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', roles)
    .eq('is_active', true)

  if (userError) {
    console.error(`Error fetching ${roles.join('/')} for notification:`, userError.message)
    return { success: false, error: userError }
  }

  if (!users || users.length === 0) return { success: true }

  const notifications = users.map(u => ({
    user_id: u.id,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
    priority: params.priority || 'medium'
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) {
    console.error('Error batch creating notifications for role:', error.message)
    return { success: false, error }
  }

  return { success: true }
}
