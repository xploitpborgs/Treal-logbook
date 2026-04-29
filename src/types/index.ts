export type Department =
  | 'front_desk'
  | 'housekeeping'
  | 'maintenance'
  | 'management'
  | 'security'
  | 'restaurant'

export type Role = 'staff' | 'supervisor' | 'gm' | 'system_admin' | 'hr'

export type Shift = 'morning' | 'afternoon' | 'night'

export type Category =
  | 'incident'
  | 'maintenance'
  | 'guest_complaint'
  | 'handover'
  | 'general'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type Status = 'open' | 'in_progress' | 'resolved' | 'escalated'

export interface Profile {
  id: string
  full_name: string
  department: Department
  role: Role
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface LogEntry {
  id: string
  created_at: string
  updated_at: string
  author_id: string
  department: Department
  shift: Shift
  category: Category
  priority: Priority
  title: string
  body: string
  status: Status
  resolved_by: string | null
  resolved_at: string | null
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'department'>
}

export interface LogComment {
  id: string
  created_at: string
  entry_id: string
  author_id: string
  comment: string
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'department' | 'role'>
}

export interface SupervisorUpdate {
  id: string
  created_at: string
  updated_at: string
  author_id: string
  department: Department
  shift: Shift
  body: string
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'department' | 'role'>
}

export interface HrUpdate {
  id: string
  created_at: string
  updated_at: string
  author_id: string
  title: string
  body: string
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'department' | 'role'>
}
