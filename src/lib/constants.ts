import type { Department, Priority, Status, Shift, Category } from '@/types'

export const STAFF_EMAIL_DOMAIN = '@trealhotel.com' as const

export const DEPT_LABELS: Record<Department, string> = {
  front_desk: 'Front Desk',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  management: 'Management',
  security: 'Security',
  restaurant: 'Restaurant',
  hr: 'Human Resources',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const STATUS_LABELS: Record<Status, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
}

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  incident: 'Incident',
  maintenance: 'Maintenance',
  guest_complaint: 'Guest Complaint',
  handover: 'Handover',
  general: 'General',
}
