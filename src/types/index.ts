export type Department =
  | 'front_desk'
  | 'housekeeping'
  | 'maintenance'
  | 'management'
  | 'security'
  | 'restaurant'
  | 'hr'

export type Role =
  | 'staff'
  | 'supervisor'
  | 'gm'
  | 'hr'
  | 'system_admin'

export type Shift = 'morning' | 'afternoon' | 'night'

export type Category =
  | 'incident'
  | 'maintenance'
  | 'guest_complaint'
  | 'handover'
  | 'general'

export type SupervisorCategory =
  | 'operational'
  | 'staffing'
  | 'guest_relations'
  | 'safety'
  | 'handover'
  | 'general'

export type HRCategory =
  | 'policy'
  | 'announcement'
  | 'training'
  | 'disciplinary'
  | 'general'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type Status = 'open' | 'in_progress' | 'resolved'

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'escalated'
  | 'resolved'
  | 'commented'
  | 'status_changed'
  | 'role_changed'
  | 'deactivated'
  | 'reactivated'

export type EntityType =
  | 'log_entry'
  | 'supervisor_update'
  | 'hr_update'
  | 'profile'
  | 'comment'

export interface Profile {
  id: string
  full_name: string
  department: Department
  team?: Department
  role: Role
  avatar_url?: string
  is_active: boolean
  created_at: string
}

export interface LogEntry {
  id: string
  created_at: string
  updated_at: string
  author_id: string
  department: Department
  team?: Department
  shift: Shift
  category: Category
  priority: Priority
  title: string
  body: string
  status: Status
  is_escalated?: boolean
  escalated_by?: string
  escalated_at?: string
  escalation_note?: string
  resolved_by?: string
  resolved_at?: string
  author?: Profile
  escalator?: Profile
  resolver?: Profile
}

export interface LogComment {
  id: string
  created_at: string
  entry_id: string
  author_id: string
  comment: string
  author?: Profile
}

export interface SupervisorUpdate {
  id: string
  created_at: string
  updated_at: string
  author_id: string
  team?: Department
  title: string
  body: string
  priority: Priority
  category: SupervisorCategory
  author?: Profile
}

export interface HRUpdate {
  id: string
  created_at: string
  updated_at: string
  author_id: string
  title: string
  body: string
  priority: Priority
  category: HRCategory
  is_pinned: boolean
  author?: Profile
}

export interface AuditLog {
  id: string
  created_at: string
  actor_id: string
  action: AuditAction
  entity_type: EntityType
  entity_id: string
  old_data?: Record<string, unknown>
  new_data?: Record<string, unknown>
  note?: string
  actor?: Profile
}
