import { supabase } from '@/lib/supabase'
import type { AuditAction, EntityType } from '@/types'

interface LogAuditParams {
  actorId: string
  action: AuditAction
  entityType: EntityType
  entityId: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  note?: string
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    actor_id:    params.actorId,
    action:      params.action,
    entity_type: params.entityType,
    entity_id:   params.entityId,
    old_data:    params.oldData  ?? null,
    new_data:    params.newData  ?? null,
    note:        params.note     ?? null,
  })
  if (error) console.error('Audit log failed:', error.message)
}
