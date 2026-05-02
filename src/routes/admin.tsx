/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { logAudit } from '@/lib/auditLogger'
import { departmentLabels, formatDepartment, formatRole, timeAgo, getInitials } from '@/lib/formatters'
import type { Profile, LogEntry, Role, Department, AuditLog } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import {
  BookOpen, Building2, CircleCheck, ClipboardList, Clock, Eye, Info,
  MessageSquare, MoreHorizontal, Search, ShieldCheck, Trash2, Trophy,
  UserPlus, Users, UserX,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

// ─── Constants ─────────────────────────────────────────────────────────────

const PAGE_SIZE       = 10
const AUDIT_PAGE_SIZE = 20

const ROLE_BADGE: Record<string, string> = {
  system_admin: 'bg-[#C41E3A]/10 text-[#C41E3A] border-transparent',
  gm:           'bg-amber-100 text-amber-700 border-transparent',
  supervisor:   'bg-blue-100 text-blue-700 border-transparent',
  hr:           'bg-purple-100 text-purple-700 border-transparent',
  staff:        'bg-zinc-100 text-zinc-600 border-transparent',
}

const ACTION_BADGE: Record<string, string> = {
  created:        'bg-green-100 text-green-700 border-transparent',
  updated:        'bg-blue-100 text-blue-700 border-transparent',
  escalated:      'bg-[#C41E3A]/10 text-[#C41E3A] border-transparent',
  resolved:       'bg-green-100 text-green-700 border-transparent',
  role_changed:   'bg-purple-100 text-purple-700 border-transparent',
  deactivated:    'bg-red-100 text-red-700 border-transparent',
  reactivated:    'bg-green-100 text-green-700 border-transparent',
  commented:      'bg-zinc-100 text-zinc-600 border-transparent',
  status_changed: 'bg-amber-100 text-amber-700 border-transparent',
  deleted:        'bg-red-100 text-red-700 border-transparent',
}

const STATUS_COLORS = ['#a1a1aa', '#f59e0b', '#22c55e']
const BAR_COLOR     = '#C41E3A'

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Route component ────────────────────────────────────────────────────────

function AdminPage() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useRole()

  useEffect(() => {
    if (profile && !isAdmin()) {
      toast.error('Access denied. System Admin access required.')
      navigate({ to: '/dashboard' })
    }
  }, [profile])

  if (!profile || !isAdmin()) return null
  return <AdminPanel />
}

// ─── Main panel ─────────────────────────────────────────────────────────────

function AdminPanel() {
  const navigate = useNavigate()
  const { profile } = useRole()

  // ── Staff state ──────────────────────────────────────────────────────────
  const [staff, setStaff]           = useState<Profile[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [search, setSearch]         = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [staffPage, setStaffPage]   = useState(0)

  // ── Operations state ─────────────────────────────────────────────────────
  const [entries, setEntries]             = useState<LogEntry[]>([])
  const [supUpdates, setSupUpdates]       = useState<{ created_at: string }[]>([])
  const [hrUpdates, setHrUpdates]         = useState<{ created_at: string }[]>([])
  const [loadingOps, setLoadingOps]       = useState(true)
  const [dateRange, setDateRange]         = useState<'today' | '7days' | '30days' | 'all'>('7days')

  // ── Audit state ───────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs]         = useState<AuditLog[]>([])
  const [loadingAudit, setLoadingAudit]   = useState(true)
  const [auditSearch, setAuditSearch]     = useState('')
  const [auditAction, setAuditAction]     = useState('all')
  const [auditEntity, setAuditEntity]     = useState('all')
  const [auditDate, setAuditDate]         = useState<'today' | '7days' | '30days' | 'all'>('all')
  const [auditPage, setAuditPage]         = useState(0)

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [addOpen, setAddOpen]             = useState(false)
  const [changeRoleTarget, setChangeRoleTarget] = useState<Profile | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null)
  const [newRole, setNewRole]             = useState<Role>('staff')

  // Add staff form state
  const [newStaff, setNewStaff] = useState({
    full_name: '', email: '', department: 'front_desk' as Department,
    role: 'staff' as Role, password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [addError, setAddError]         = useState<string | null>(null)
  const [isAdding, setIsAdding]         = useState(false)
  const [isSavingRole, setIsSavingRole] = useState(false)

  // ─── Data fetches ──────────────────────────────────────────────────────

  const fetchStaff = async () => {
    setLoadingStaff(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    if (data) setStaff(data as Profile[])
    setLoadingStaff(false)
  }

  const fetchOps = async () => {
    setLoadingOps(true)
    const [entriesRes, supRes, hrRes] = await Promise.all([
      supabase.from('log_entries')
        .select('*, author:profiles!author_id(id, full_name, department, team, role)')
        .order('created_at', { ascending: false }),
      supabase.from('supervisor_updates').select('created_at').order('created_at', { ascending: false }),
      supabase.from('hr_updates').select('created_at').order('created_at', { ascending: false }),
    ])
    if (entriesRes.data) setEntries(entriesRes.data as unknown as LogEntry[])
    if (supRes.data)     setSupUpdates(supRes.data)
    if (hrRes.data)      setHrUpdates(hrRes.data)
    setLoadingOps(false)
  }

  const fetchAudit = async () => {
    setLoadingAudit(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*, actor:profiles(id, full_name, department, role)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (data) setAuditLogs(data as unknown as AuditLog[])
    setLoadingAudit(false)
  }

  const [departments, setDepartments] = useState<{ id: string, name: string, label: string }[]>([])
  const [loadingDepts, setLoadingDepts] = useState(false)
  const [newDept, setNewDept] = useState({ name: '', label: '' })
  const [isAddingDept, setIsAddingDept] = useState(false)

  const fetchDepartmentsFromDB = async () => {
    setLoadingDepts(true)
    const { data } = await supabase.from('departments').select('*').order('label')
    if (data) setDepartments(data)
    setLoadingDepts(false)
  }

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDept.name || !newDept.label) return
    setIsAddingDept(true)
    const { error } = await supabase.from('departments').insert([
      { name: newDept.name.toLowerCase().replace(/\s+/g, '_'), label: newDept.label }
    ])
    if (error) {
      toast.error('Failed to add department: ' + error.message)
    } else {
      toast.success('Department added')
      setNewDept({ name: '', label: '' })
      fetchDepartmentsFromDB()
    }
    setIsAddingDept(false)
  }

  const handleDeleteDepartment = async (id: string) => {
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete department: ' + error.message)
    } else {
      toast.success('Department deleted')
      fetchDepartmentsFromDB()
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStaff()
    fetchOps()
    fetchAudit()
    fetchDepartmentsFromDB()
  }, [])

  // ─── Staff computed ────────────────────────────────────────────────────

  const activeCount     = staff.filter(s => s.is_active).length
  const inactiveCount   = staff.filter(s => !s.is_active).length
  const uniqueDepts     = new Set(staff.filter(s => s.is_active).map(s => s.department)).size
  const supervisorCount = staff.filter(s => s.role === 'supervisor').length

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      if (search && !s.full_name.toLowerCase().includes(search.toLowerCase())) return false
      if (deptFilter !== 'all' && s.department !== deptFilter) return false
      if (roleFilter !== 'all' && s.role !== roleFilter) return false
      if (statusFilter === 'active' && !s.is_active) return false
      if (statusFilter === 'inactive' && s.is_active) return false
      return true
    })
  }, [staff, search, deptFilter, roleFilter, statusFilter])

  const staffTotalPages = Math.ceil(filteredStaff.length / PAGE_SIZE)
  const pagedStaff      = filteredStaff.slice(staffPage * PAGE_SIZE, (staffPage + 1) * PAGE_SIZE)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setStaffPage(0) }, [search, deptFilter, roleFilter, statusFilter])

  // ─── Operations computed ───────────────────────────────────────────────

  function inRange(dateStr: string) {
    const now = Date.now()
    const t   = new Date(dateStr).getTime()
    if (dateRange === 'today')  return new Date(dateStr).toDateString() === new Date().toDateString()
    if (dateRange === '7days')  return now - t <= 7  * 86400000
    if (dateRange === '30days') return now - t <= 30 * 86400000
    return true
  }

  const filteredEntries   = useMemo(() => entries.filter(e => inRange(e.created_at)), [entries, dateRange])
  const filteredSup       = useMemo(() => supUpdates.filter(u => inRange(u.created_at)), [supUpdates, dateRange])
  const filteredHR        = useMemo(() => hrUpdates.filter(u => inRange(u.created_at)), [hrUpdates, dateRange])

  const deptChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredEntries.forEach(e => { counts[e.department] = (counts[e.department] || 0) + 1 })
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept: formatDepartment(dept), count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredEntries])

  const statusChartData = useMemo(() => [
    { name: 'Open',        value: filteredEntries.filter(e => e.status === 'open').length },
    { name: 'In Progress', value: filteredEntries.filter(e => e.status === 'in_progress').length },
    { name: 'Resolved',    value: filteredEntries.filter(e => e.status === 'resolved').length },
  ], [filteredEntries])

  const priorityData = useMemo(() => [
    { label: 'Urgent', color: '#C41E3A', count: filteredEntries.filter(e => e.priority === 'urgent').length },
    { label: 'High',   color: '#f59e0b', count: filteredEntries.filter(e => e.priority === 'high').length },
    { label: 'Medium', color: '#3b82f6', count: filteredEntries.filter(e => e.priority === 'medium').length },
    { label: 'Low',    color: '#a1a1aa', count: filteredEntries.filter(e => e.priority === 'low').length },
  ], [filteredEntries])

  const avgResolutionHours = useMemo(() => {
    const resolved = filteredEntries.filter(e => e.status === 'resolved' && e.resolved_at)
    if (!resolved.length) return null
    const avgMs = resolved.reduce((s, e) =>
      s + (new Date(e.resolved_at!).getTime() - new Date(e.created_at).getTime()), 0
    ) / resolved.length
    const hours = avgMs / 3600000
    return hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`
  }, [filteredEntries])

  const dailyData = useMemo(() => {
    if (dateRange === 'today' || dateRange === 'all') return []
    const days: Record<string, number> = {}
    filteredEntries.forEach(e => {
      const day = e.created_at.split('T')[0]
      days[day] = (days[day] || 0) + 1
    })
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        count,
      }))
  }, [filteredEntries, dateRange])

  const mostActiveDept = deptChartData[0]

  // ─── Audit computed ────────────────────────────────────────────────────

  const filteredAudit = useMemo(() => {
    const now = Date.now()
    return auditLogs.filter(log => {
      const t = new Date(log.created_at).getTime()
      if (auditDate === 'today'  && new Date(log.created_at).toDateString() !== new Date().toDateString()) return false
      if (auditDate === '7days'  && now - t > 7  * 86400000) return false
      if (auditDate === '30days' && now - t > 30 * 86400000) return false
      if (auditAction !== 'all' && log.action      !== auditAction) return false
      if (auditEntity !== 'all' && log.entity_type !== auditEntity) return false
      if (auditSearch) {
        const q = auditSearch.toLowerCase()
        const name = log.actor?.full_name?.toLowerCase() ?? ''
        const note = (log.note ?? '').toLowerCase()
        if (!name.includes(q) && !note.includes(q)) return false
      }
      return true
    })
  }, [auditLogs, auditDate, auditAction, auditEntity, auditSearch])

  const auditTotalPages = Math.ceil(filteredAudit.length / AUDIT_PAGE_SIZE)
  const pagedAudit      = filteredAudit.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setAuditPage(0) }, [auditSearch, auditAction, auditEntity, auditDate])

  // ─── Staff actions ─────────────────────────────────────────────────────

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!newStaff.email.endsWith('@trealhotel.com')) {
      setAddError('Email must be a @trealhotel.com address')
      return
    }
    setIsAdding(true)
    try {
      const adminClient = createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      const { data, error } = await adminClient.auth.signUp({
        email:    newStaff.email,
        password: newStaff.password,
        options:  { data: { full_name: newStaff.full_name, department: newStaff.department, role: newStaff.role } },
      })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id, full_name: newStaff.full_name,
          department: newStaff.department, team: newStaff.department,
          role: newStaff.role, is_active: true,
        })
        logAudit({
          actorId: profile!.id, action: 'created', entityType: 'profile',
          entityId: data.user.id, note: 'Staff account created by admin',
        })
      }
      toast.success(`${newStaff.full_name} added successfully`)
      setAddOpen(false)
      setNewStaff({ full_name: '', email: '', department: 'front_desk', role: 'staff', password: '' })
      fetchStaff()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add staff'
      setAddError(msg.includes('already registered') ? 'An account with this email already exists.' : msg)
    } finally {
      setIsAdding(false)
    }
  }

  const handleChangeRole = async () => {
    if (!changeRoleTarget) return
    setIsSavingRole(true)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', changeRoleTarget.id)
    setIsSavingRole(false)
    if (error) { toast.error('Failed to update role'); return }
    logAudit({
      actorId: profile!.id, action: 'role_changed', entityType: 'profile',
      entityId: changeRoleTarget.id,
      oldData: { role: changeRoleTarget.role },
      newData: { role: newRole },
      note: 'Role changed by admin',
    })
    toast.success(`${changeRoleTarget.full_name}'s role updated to ${formatRole(newRole)}`)
    setStaff(s => s.map(u => u.id === changeRoleTarget.id ? { ...u, role: newRole } : u))
    setChangeRoleTarget(null)
  }

  const handleDeactivate = async (member: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', member.id)
    if (error) { toast.error('Failed to deactivate account'); return }
    logAudit({ actorId: profile!.id, action: 'deactivated', entityType: 'profile', entityId: member.id, note: 'Account deactivated by admin' })
    toast.success(`${member.full_name}'s account has been deactivated`)
    setStaff(s => s.map(u => u.id === member.id ? { ...u, is_active: false } : u))
    setDeactivateTarget(null)
  }

  const handleReactivate = async (member: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', member.id)
    if (error) { toast.error('Failed to reactivate account'); return }
    logAudit({ actorId: profile!.id, action: 'reactivated', entityType: 'profile', entityId: member.id, note: 'Account reactivated by admin' })
    toast.success(`${member.full_name}'s account has been reactivated`)
    setStaff(s => s.map(u => u.id === member.id ? { ...u, is_active: true } : u))
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Admin Panel</h1>
            <p className="text-sm text-zinc-500 mt-1">Manage staff, monitor operations and review audit logs</p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            className="shrink-0 gap-2 bg-[#C41E3A] hover:bg-[#a01830] text-white"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Staff</span>
          </Button>
        </div>

        <Tabs defaultValue="staff">
          <TabsList className="border border-zinc-200 bg-zinc-50">
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>

          {/* ══ TAB 1: STAFF MANAGEMENT ══ */}
          <TabsContent value="staff" className="mt-6 space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {([
                { icon: Users,      label: 'Active Staff',       value: activeCount,     color: '#3b82f6' },
                { icon: Building2,  label: 'Departments Active', value: uniqueDepts,     color: '#a1a1aa' },
                { icon: ShieldCheck,label: 'Supervisors',        value: supervisorCount, color: '#3b82f6' },
                { icon: UserX,      label: 'Inactive Accounts',  value: inactiveCount,   color: '#f59e0b' },
              ] as const).map(({ icon: Icon, label, value, color }) => (
                <Card key={label} className="relative overflow-hidden border-zinc-200 shadow-none">
                  <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
                  <CardContent className="p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 mb-3">
                      <Icon className="h-4 w-4 text-zinc-600" />
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900">{loadingStaff ? '—' : value}</p>
                    <p className="text-sm text-zinc-500">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Staff table */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-4">

                {/* Filters */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      placeholder="Search by name…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.length > 0 ? (
                        departments.map(d => (
                          <SelectItem key={d.name} value={d.name}>{d.label}</SelectItem>
                        ))
                      ) : (
                        Object.entries(departmentLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="gm">GM</SelectItem>
                      <SelectItem value="system_admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loadingStaff ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : pagedStaff.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Users className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm text-zinc-400">No staff found</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-zinc-100">
                      {pagedStaff.map(member => (
                        <div key={member.id} className="flex items-center gap-3 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
                            {getInitials(member.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900">{member.full_name}</p>
                            <p className="truncate text-xs text-zinc-400">
                              {formatDepartment(member.department)} · Joined {shortDate(member.created_at)}
                            </p>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <Badge className={`shadow-none text-xs ${ROLE_BADGE[member.role] ?? ''}`}>
                              {formatRole(member.role)}
                            </Badge>
                            <Badge className={`shadow-none text-xs border-transparent ${
                              member.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-400'
                            }`}>
                              {member.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to="/dashboard" className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" /> View Issues
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setChangeRoleTarget(member); setNewRole(member.role) }}>
                                <ShieldCheck className="mr-2 h-4 w-4" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {member.is_active ? (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setDeactivateTarget(member)}
                                >
                                  <UserX className="mr-2 h-4 w-4" /> Deactivate Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-green-600 focus:text-green-600"
                                  onClick={() => handleReactivate(member)}
                                >
                                  <Users className="mr-2 h-4 w-4" /> Reactivate Account
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>

                    {staffTotalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                        <span>
                          {staffPage * PAGE_SIZE + 1}–{Math.min((staffPage + 1) * PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={staffPage === 0} onClick={() => setStaffPage(p => p - 1)}>Previous</Button>
                          <Button variant="outline" size="sm" disabled={staffPage >= staffTotalPages - 1} onClick={() => setStaffPage(p => p + 1)}>Next</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TAB 2: OPERATIONS OVERVIEW ══ */}
          <TabsContent value="operations" className="mt-6 space-y-6">

            {/* Date range selector */}
            <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 w-fit">
              {([['today', 'Today'], ['7days', '7 Days'], ['30days', '30 Days'], ['all', 'All Time']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDateRange(val)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    dateRange === val ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingOps ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
              </div>
            ) : (
              <>
                {/* Issue stats */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { icon: BookOpen,    label: 'Total Issues',       value: filteredEntries.length,                                       color: '#a1a1aa' },
                    { icon: Users,       label: 'Escalated',          value: filteredEntries.filter(e => e.is_escalated).length,           color: '#C41E3A' },
                    { icon: CircleCheck, label: 'Resolved',           value: filteredEntries.filter(e => e.status === 'resolved').length,  color: '#22c55e' },
                    { icon: MessageSquare,label:'Supervisor Updates', value: filteredSup.length,                                           color: '#3b82f6' },
                    { icon: ClipboardList,label:'HR Updates',         value: filteredHR.length,                                           color: '#7c3aed' },
                    { icon: Clock,       label: 'Avg Resolution',     value: avgResolutionHours ?? '—',                                   color: '#f59e0b' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <Card key={label} className="border-zinc-200 shadow-none">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18` }}>
                          <Icon className="h-5 w-5" style={{ color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-bold text-zinc-900">{value}</p>
                          <p className="text-xs text-zinc-500 truncate">{label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Most active dept */}
                {mostActiveDept && (
                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <Trophy className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-700">Most Active Department</p>
                        <p className="text-lg font-semibold text-zinc-900">{mostActiveDept.dept}</p>
                        <p className="text-xs text-zinc-400">{mostActiveDept.count} issues in selected period</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Charts */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-700 mb-4">Issues by Department</p>
                      {deptChartData.length === 0 ? (
                        <p className="text-sm text-zinc-400">No data for selected period</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={deptChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="dept" tick={{ fontSize: 11 }} width={90} />
                            <Tooltip cursor={{ fill: '#f4f4f5' }} />
                            <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-700 mb-4">Issues by Status</p>
                      {filteredEntries.length === 0 ? (
                        <p className="text-sm text-zinc-400">No data for selected period</p>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={130}>
                            <PieChart>
                              <Pie data={statusChartData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                                {statusChartData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i]} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="mt-2 space-y-1">
                            {statusChartData.map((d, i) => (
                              <div key={d.name} className="flex items-center justify-between text-xs text-zinc-500">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[i] }} />
                                  {d.name}
                                </div>
                                <span className="font-medium text-zinc-700">{d.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Priority breakdown */}
                <Card className="border-zinc-200 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-4">Issues by Priority</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {priorityData.map(({ label, color, count }) => (
                        <div key={label} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-3">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-zinc-900">{count}</p>
                            <p className="text-xs text-zinc-500">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Daily activity (7days / 30days only) */}
                {dailyData.length > 0 && (
                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-700 mb-4">Daily Activity</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={dailyData} margin={{ left: 0, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke={BAR_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Recent activity */}
                <Card className="border-zinc-200 shadow-none">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-700">Recent Activity</p>
                      <Link to="/issues">
                        <Button variant="ghost" size="sm" className="text-xs text-zinc-500">View All</Button>
                      </Link>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {entries.slice(0, 10).map(entry => (
                        <Link
                          key={entry.id}
                          to="/issues/$issueId"
                          params={{ issueId: entry.id } as any}
                          className="flex items-start justify-between gap-3 py-3 -mx-4 px-4 hover:bg-zinc-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">{entry.title}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {formatDepartment(entry.department)} · {timeAgo(entry.created_at)}
                            </p>
                          </div>
                          <Badge className={`shrink-0 text-xs shadow-none border-transparent ${
                            entry.priority === 'urgent' ? 'bg-[#C41E3A]/10 text-[#C41E3A]' :
                            entry.priority === 'high'   ? 'bg-amber-100 text-amber-700' :
                            entry.priority === 'medium' ? 'bg-blue-100 text-blue-700'   :
                            'bg-zinc-100 text-zinc-500'
                          }`}>
                            {entry.priority}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ══ TAB 3: AUDIT LOG ══ */}
          <TabsContent value="audit" className="mt-6 space-y-4">

            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                The audit log records all significant actions taken in the system — role changes, account management, escalations and resolutions.
              </AlertDescription>
            </Alert>

            {/* Audit filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search by actor or note…"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={auditAction} onValueChange={setAuditAction}>
                <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder="Action Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="status_changed">Status Changed</SelectItem>
                  <SelectItem value="role_changed">Role Changed</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                  <SelectItem value="reactivated">Reactivated</SelectItem>
                  <SelectItem value="commented">Commented</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditEntity} onValueChange={setAuditEntity}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Entity Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="log_entry">Issue</SelectItem>
                  <SelectItem value="profile">Profile</SelectItem>
                  <SelectItem value="supervisor_update">Supervisor Update</SelectItem>
                  <SelectItem value="hr_update">HR Update</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                {([['today', 'Today'], ['7days', '7d'], ['30days', '30d'], ['all', 'All']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setAuditDate(val)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      auditDate === val ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(auditSearch || auditAction !== 'all' || auditEntity !== 'all' || auditDate !== 'all') && (
                <Button
                  variant="ghost" size="sm"
                  className="text-xs text-zinc-500"
                  onClick={() => { setAuditSearch(''); setAuditAction('all'); setAuditEntity('all'); setAuditDate('all') }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Audit table */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-0">
                {loadingAudit ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                  </div>
                ) : filteredAudit.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <ClipboardList className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm text-zinc-400">No audit log entries</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                          <TableHead className="w-[130px]">Action</TableHead>
                          <TableHead className="hidden md:table-cell w-[160px]">Entity</TableHead>
                          <TableHead>Performed By</TableHead>
                          <TableHead className="hidden sm:table-cell">Details</TableHead>
                          <TableHead className="w-[110px] text-right">When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedAudit.map(log => (
                          <TableRow
                            key={log.id}
                            className={log.entity_type === 'log_entry' ? 'cursor-pointer hover:bg-zinc-50' : 'hover:bg-zinc-50'}
                            onClick={() => {
                              if (log.entity_type === 'log_entry') {
                                navigate({ to: '/issues/$issueId', params: { issueId: log.entity_id } as any })
                              }
                            }}
                          >
                            <TableCell className="py-3">
                              <Badge className={`text-xs shadow-none capitalize ${ACTION_BADGE[log.action] ?? 'bg-zinc-100 text-zinc-600 border-transparent'}`}>
                                {log.action.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-3 text-xs text-zinc-500">
                              <span className="font-mono">{log.entity_type}</span>
                              <span className="block text-zinc-400 truncate max-w-[120px]">{log.entity_id.slice(0, 8)}…</span>
                            </TableCell>
                            <TableCell className="py-3">
                              {log.actor ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-[10px] font-semibold text-white">
                                    {getInitials(log.actor.full_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-zinc-900 truncate">{log.actor.full_name}</p>
                                    <Badge className={`text-[10px] shadow-none ${ROLE_BADGE[log.actor.role] ?? ''}`}>
                                      {formatRole(log.actor.role)}
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-400">System</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-3 text-xs text-zinc-500 max-w-[200px]">
                              <span className="truncate block">{log.note ? log.note.slice(0, 60) : '—'}</span>
                            </TableCell>
                            <TableCell className="py-3 text-right text-xs text-zinc-400 whitespace-nowrap">
                              {timeAgo(log.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {auditTotalPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-zinc-100 text-sm text-zinc-500">
                        <span>
                          {auditPage * AUDIT_PAGE_SIZE + 1}–{Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, filteredAudit.length)} of {filteredAudit.length}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={auditPage === 0} onClick={() => setAuditPage(p => p - 1)}>Previous</Button>
                          <Button variant="outline" size="sm" disabled={auditPage >= auditTotalPages - 1} onClick={() => setAuditPage(p => p + 1)}>Next</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TAB 4: DEPARTMENTS ══ */}
          <TabsContent value="departments" className="mt-6 space-y-4">

            {/* Add form */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-zinc-700 mb-4">Add Department</p>
                <form onSubmit={handleAddDepartment} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-zinc-500">Name (Label)</Label>
                    <Input
                      placeholder="e.g. Front Office"
                      value={newDept.label}
                      onChange={e => setNewDept(s => ({ ...s, label: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-zinc-500">Identifier (Slug)</Label>
                    <Input
                      placeholder="e.g. front_office"
                      value={newDept.name}
                      onChange={e => setNewDept(s => ({ ...s, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={isAddingDept}
                      className="bg-[#C41E3A] hover:bg-[#a01830] text-white w-full sm:w-auto"
                    >
                      {isAddingDept ? 'Adding…' : 'Add Department'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Department list */}
            <Card className="border-zinc-200 shadow-none">
              <CardContent className="p-0">
                {loadingDepts ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : departments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Building2 className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-500">No departments added yet</p>
                    <p className="text-xs text-zinc-400">Use the form above to add your first department.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {departments.map(dept => (
                      <div key={dept.id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                          <Building2 className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900">{dept.label}</p>
                          <p className="text-xs font-mono text-zinc-400">{dept.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete '${dept.label}'?`)) handleDeleteDepartment(dept.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                Deleting a department that still has staff assigned may cause display issues. Reassign staff before deleting.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Add Staff Dialog ── */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { setAddError(null); setShowPassword(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Create a new staff account for Treal Hotels &amp; Suites.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                required
                placeholder="Jane Doe"
                value={newStaff.full_name}
                onChange={e => setNewStaff(s => ({ ...s, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                required
                type="email"
                placeholder="jane@trealhotel.com"
                value={newStaff.email}
                onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select
                  value={newStaff.department}
                  onValueChange={v => setNewStaff(s => ({ ...s, department: v as Department }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departments.length > 0 ? (
                      departments.map(d => (
                        <SelectItem key={d.name} value={d.name}>{d.label}</SelectItem>
                      ))
                    ) : (
                      Object.entries(departmentLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={newStaff.role}
                  onValueChange={v => setNewStaff(s => ({ ...s, role: v as Role }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-400">GM and System Admin must be assigned in Supabase.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password</Label>
              <div className="relative">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  placeholder="Min 8 characters"
                  value={newStaff.password}
                  onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-800"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-zinc-400">Staff member should change this on first login.</p>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isAdding} className="bg-[#C41E3A] hover:bg-[#a01830] text-white">
                {isAdding ? 'Creating…' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Role Dialog ── */}
      <Dialog open={!!changeRoleTarget} onOpenChange={open => { if (!open) setChangeRoleTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update {changeRoleTarget?.full_name}'s role and permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              Current role:
              <Badge className={`shadow-none ${ROLE_BADGE[changeRoleTarget?.role ?? ''] ?? ''}`}>
                {formatRole(changeRoleTarget?.role ?? '')}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {changeRoleTarget?.role === 'supervisor' && newRole === 'staff' && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="text-amber-800 text-xs">
                  This will remove their ability to escalate issues and post supervisor updates.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeRoleTarget(null)}>Cancel</Button>
            <Button
              disabled={isSavingRole || newRole === changeRoleTarget?.role}
              onClick={handleChangeRole}
              className="bg-[#C41E3A] hover:bg-[#a01830] text-white"
            >
              {isSavingRole ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate AlertDialog ── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={open => { if (!open) setDeactivateTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent them from logging in. Their data will be preserved. You can reactivate at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deactivateTarget && handleDeactivate(deactivateTarget)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
