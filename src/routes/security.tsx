import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuthContext } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react'

export const Route = createFileRoute('/security')({
  component: SecurityMonitorPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'login_rate_limited'
  | 'inactive_account_blocked'
  | 'unauthorized_access'
  | 'form_rate_limited'
  | 'session_expired'

interface SecurityEvent {
  event: SecurityEventType
  detail?: string
  ts: string
  path: string
}

// ─── Event display config ─────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  SecurityEventType,
  { label: string; color: string; icon: typeof ShieldAlert; severity: 'critical' | 'warning' | 'info' | 'success' }
> = {
  login_failed:            { label: 'Login Failed',          color: 'bg-red-100 text-red-700 border-transparent',    icon: ShieldAlert,   severity: 'critical' },
  login_rate_limited:      { label: 'Rate Limited',          color: 'bg-orange-100 text-orange-700 border-transparent', icon: AlertTriangle, severity: 'critical' },
  inactive_account_blocked:{ label: 'Inactive Account',      color: 'bg-red-100 text-red-700 border-transparent',    icon: UserX,         severity: 'critical' },
  unauthorized_access:     { label: 'Unauthorised Access',   color: 'bg-red-100 text-red-700 border-transparent',    icon: ShieldAlert,   severity: 'critical' },
  session_expired:         { label: 'Session Expired',       color: 'bg-amber-100 text-amber-700 border-transparent', icon: Clock,         severity: 'warning'  },
  form_rate_limited:       { label: 'Form Rate Limited',     color: 'bg-amber-100 text-amber-700 border-transparent', icon: AlertTriangle, severity: 'warning'  },
  login_success:           { label: 'Login Success',         color: 'bg-green-100 text-green-700 border-transparent', icon: CheckCircle2,  severity: 'success'  },
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, success: 3 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  color: string
  icon: typeof ShieldAlert
}) {
  return (
    <Card className="border-zinc-200 shadow-none">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-900">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SecurityMonitorPage() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [clearOpen, setClearOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'success'>('all')

  // Redirect non-admins
  useEffect(() => {
    if (profile && profile.role !== 'system_admin') {
      toast.error('Access denied.')
      navigate({ to: '/dashboard' })
    }
  }, [profile, navigate])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    console.log('Security events fetch:', { data, error })

    if (data && !error) {
      setEvents(
        data.map((row: any) => ({
          event: row.event_type as SecurityEventType,
          detail: row.description,
          ts: row.created_at,
          path: row.path,
        }))
      )
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleClear = async () => {
    // Delete all events from the table
    const { error } = await supabase
      .from('security_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Match all records securely
      
    if (!error) {
      setEvents([])
      setClearOpen(false)
      toast.success('Security log cleared')
    } else {
      toast.error('Failed to clear logs')
    }
  }

  const criticalCount = events.filter(e => EVENT_CONFIG[e.event]?.severity === 'critical').length
  const warningCount  = events.filter(e => EVENT_CONFIG[e.event]?.severity === 'warning').length
  const successCount  = events.filter(e => EVENT_CONFIG[e.event]?.severity === 'success').length

  const filtered = filter === 'all'
    ? events
    : events.filter(e => EVENT_CONFIG[e.event]?.severity === filter)

  const sorted = [...filtered].sort(
    (a, b) =>
      SEVERITY_ORDER[EVENT_CONFIG[a.event]?.severity ?? 'info'] -
      SEVERITY_ORDER[EVENT_CONFIG[b.event]?.severity ?? 'info'] ||
      new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  )

  if (profile && profile.role !== 'system_admin') return null

  return (
    <AppLayout title="Security Monitor">
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Security Monitor</h1>
            <p className="mt-0.5 text-sm text-zinc-500 hidden sm:block">
              Live security events from all staff sessions across the platform
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearOpen(true)}
              disabled={events.length === 0}
              className="gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Log</span>
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Events"   value={events.length}  color="bg-zinc-100 text-zinc-600"   icon={ShieldCheck}   />
          <StatCard label="Critical"        value={criticalCount}  color="bg-red-100 text-red-600"     icon={ShieldAlert}   />
          <StatCard label="Warnings"        value={warningCount}   color="bg-amber-100 text-amber-600" icon={AlertTriangle} />
          <StatCard label="Successful Auth" value={successCount}   color="bg-green-100 text-green-600" icon={CheckCircle2}  />
        </div>

        {/* Session scope notice removed since it's now persistent */}

        {/* Filter pills */}
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {([
            ['all',      'All Events'],
            ['critical', 'Critical'],
            ['warning',  'Warnings'],
            ['success',  'Auth Success'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                filter === val ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Event list */}
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No events recorded</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Security events will appear here as users interact with the app
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {sorted.map((evt, i) => {
                  const cfg = EVENT_CONFIG[evt.event] ?? {
                    label: evt.event,
                    color: 'bg-zinc-100 text-zinc-600 border-transparent',
                    icon: Info,
                    severity: 'info' as const,
                  }
                  const Icon = cfg.icon
                  return (
                    <div key={i} className="flex items-start gap-4 px-4 py-4">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        cfg.severity === 'critical' ? 'bg-red-100' :
                        cfg.severity === 'warning'  ? 'bg-amber-100' :
                        cfg.severity === 'success'  ? 'bg-green-100' : 'bg-zinc-100'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          cfg.severity === 'critical' ? 'text-red-600' :
                          cfg.severity === 'warning'  ? 'text-amber-600' :
                          cfg.severity === 'success'  ? 'text-green-600' : 'text-zinc-500'
                        }`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge className={`${cfg.color} shadow-none text-xs`}>
                            {cfg.label}
                          </Badge>
                          {evt.detail && (
                            <span className="text-xs text-zinc-400 truncate max-w-[200px]">
                              {evt.detail}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTs(evt.ts)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {evt.path}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clear confirmation */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear security log?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all recorded security events from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleClear}
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
