export const departmentLabels: Record<string, string> = {
  front_desk:   'Front Desk',
  housekeeping: 'Housekeeping',
  maintenance:  'Maintenance',
  management:   'Management',
  security:     'Security',
  restaurant:   'Restaurant',
  hr:           'Human Resources',
}

export const shiftLabels: Record<string, string> = {
  morning:   'Morning',
  afternoon: 'Afternoon',
  night:     'Night',
}

export const categoryLabels: Record<string, string> = {
  incident:        'Incident',
  maintenance:     'Maintenance',
  guest_complaint: 'Guest Complaint',
  handover:        'Handover',
  general:         'General',
}

export const supervisorCategoryLabels: Record<string, string> = {
  operational:     'Operational',
  staffing:        'Staffing',
  guest_relations: 'Guest Relations',
  safety:          'Safety',
  handover:        'Handover',
  general:         'General',
}

export const hrCategoryLabels: Record<string, string> = {
  policy:        'Policy',
  announcement:  'Announcement',
  training:      'Training',
  disciplinary:  'Disciplinary',
  general:       'General',
}

export const priorityLabels: Record<string, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
}

export const statusLabels: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
}

export const roleLabels: Record<string, string> = {
  staff:        'Staff',
  supervisor:   'Supervisor',
  gm:           'General Manager',
  hr:           'Human Resources',
  system_admin: 'System Admin',
}

export function formatDepartment(dept: string): string {
  return departmentLabels[dept] ?? dept
}

export function formatShift(shift: string): string {
  return shiftLabels[shift] ?? shift
}

export function formatCategory(cat: string): string {
  return categoryLabels[cat] ?? cat
}

export function formatPriority(priority: string): string {
  return priorityLabels[priority] ?? priority
}

export function formatStatus(status: string): string {
  return statusLabels[status] ?? status
}

export function formatRole(role: string): string {
  return roleLabels[role] ?? role
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function timeAgo(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function detectShift(): 'morning' | 'afternoon' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 14)  return 'morning'
  if (hour >= 14 && hour < 22) return 'afternoon'
  return 'night'
}
