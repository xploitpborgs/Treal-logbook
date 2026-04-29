import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuthContext } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Profile, LogEntry, Role, Department } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { Building2, Eye, MoreHorizontal, Search, ShieldCheck, UserPlus, Users, UserX } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { DEPT_LABELS } from '@/lib/constants'

export const Route = createFileRoute('/admin')({
  component: AdminPanel,
})

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTimeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 7 ? `${days}d ago` : formatDate(d)
}

const ROLE_BADGE: Record<Role, string> = {
  system_admin: 'bg-purple-100 text-purple-700 border-transparent',
  gm: 'bg-[#a31e22]/10 text-[#a31e22] border-transparent',
  supervisor: 'bg-blue-100 text-blue-700 border-transparent',
  staff: 'bg-zinc-100 text-zinc-600 border-transparent',
  hr: 'bg-emerald-100 text-emerald-700 border-transparent',
}

const ROLE_LABEL: Record<Role, string> = {
  system_admin: 'System Admin',
  gm: 'GM',
  supervisor: 'Supervisor',
  staff: 'Staff',
  hr: 'HR',
}

const STATUS_COLORS = ['#a1a1aa', '#f59e0b', '#22c55e']
const BAR_COLOR = '#a31e22'

// ─── Main Component ────────────────────────────────────────────────────────

function AdminPanel() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [staff, setStaff] = useState<Profile[]>([])
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)

  // Staff table filters
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  // Operations date range
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days')

  // Dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [changeRoleTarget, setChangeRoleTarget] = useState<Profile | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null)
  const [newRole, setNewRole] = useState<Role>('staff')

  // Add staff form
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', department: 'front_desk' as Department, role: 'staff' as Role, password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isSavingRole, setIsSavingRole] = useState(false)

  const isSystemAdmin = profile?.role === 'system_admin'

  // Redirect if not system_admin
  useEffect(() => {
    if (profile && profile.role !== 'system_admin') {
      toast.error('Access denied. System Admin access required.')
      navigate({ to: '/dashboard' })
    }
  }, [profile, navigate])

  useEffect(() => {
    if (profile?.role === 'system_admin') {
      fetchStaff()
      fetchEntries()
    }
  }, [profile])

  const fetchStaff = async () => {
    setLoadingStaff(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    if (data) setStaff(data as Profile[])
    setLoadingStaff(false)
  }

  const fetchEntries = async () => {
    setLoadingEntries(true)
    const { data } = await supabase
      .from('log_entries')
      .select('*, author:profiles!author_id(id, full_name, department, role)')
      .order('created_at', { ascending: false })
    if (data) setEntries(data as unknown as LogEntry[])
    setLoadingEntries(false)
  }

  // ─── Staff stats ──────────────────────────────────────────────────────────
  const activeStaff = staff.filter(s => s.is_active)
  const inactiveStaff = staff.filter(s => !s.is_active)
  const uniqueDepts = new Set(activeStaff.map(s => s.department)).size
  const supervisorCount = staff.filter(s => s.role === 'supervisor').length

  // ─── Staff table filtering + pagination ───────────────────────────────────
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      if (search && !s.full_name.toLowerCase().includes(search.toLowerCase())) return false
      if (deptFilter !== 'all' && s.department !== deptFilter) return false
      if (roleFilter !== 'all' && s.role !== roleFilter) return false
      return true
    })
  }, [staff, search, deptFilter, roleFilter])

  const totalPages = Math.ceil(filteredStaff.length / PAGE_SIZE)
  const pagedStaff = filteredStaff.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [search, deptFilter, roleFilter])

  // ─── Operations data ──────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    const now = Date.now()
    return entries.filter(e => {
      if (dateRange === 'today') {
        return new Date(e.created_at).toDateString() === new Date().toDateString()
      } else if (dateRange === '7days') {
        return now - new Date(e.created_at).getTime() <= 7 * 86400000
      } else if (dateRange === '30days') {
        return now - new Date(e.created_at).getTime() <= 30 * 86400000
      }
      return true
    })
  }, [entries, dateRange])

  const deptChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredEntries.forEach(e => { counts[e.department] = (counts[e.department] || 0) + 1 })
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept: DEPT_LABELS[dept as Department] ?? dept, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredEntries])

  const statusChartData = useMemo(() => [
    { name: 'Open', value: filteredEntries.filter(e => e.status === 'open').length },
    { name: 'In Progress', value: filteredEntries.filter(e => e.status === 'in_progress').length },
    { name: 'Resolved', value: filteredEntries.filter(e => e.status === 'resolved').length },
  ], [filteredEntries])

  const priorityData = useMemo(() => [
    { label: 'Urgent', color: '#a31e22', count: filteredEntries.filter(e => e.priority === 'urgent').length },
    { label: 'High', color: '#f59e0b', count: filteredEntries.filter(e => e.priority === 'high').length },
    { label: 'Medium', color: '#3b82f6', count: filteredEntries.filter(e => e.priority === 'medium').length },
    { label: 'Low', color: '#a1a1aa', count: filteredEntries.filter(e => e.priority === 'low').length },
  ], [filteredEntries])

  const avgResolutionHours = useMemo(() => {
    const resolved = filteredEntries.filter(e => e.status === 'resolved' && e.resolved_at)
    if (!resolved.length) return null
    const total = resolved.reduce((sum, e) => sum + (new Date(e.resolved_at!).getTime() - new Date(e.created_at).getTime()), 0)
    const avgMs = total / resolved.length
    const hours = avgMs / 3600000
    return hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`
  }, [filteredEntries])

  const mostActiveDept = deptChartData[0]

  // ─── Staff actions ────────────────────────────────────────────────────────
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!newStaff.email.endsWith('@trealhotel.com')) {
      setAddError('Email must end with @trealhotel.com')
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
        email: newStaff.email,
        password: newStaff.password,
        options: { data: { full_name: newStaff.full_name, department: newStaff.department, role: newStaff.role } },
      })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id, full_name: newStaff.full_name,
          department: newStaff.department, role: newStaff.role, is_active: true,
        })
      }
      toast.success(`${newStaff.full_name} added successfully`)
      setAddOpen(false)
      setNewStaff({ full_name: '', email: '', department: 'front_desk', role: 'staff', password: '' })
      fetchStaff()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add staff'
      setAddError(msg.includes('already registered') ? 'An account with this email already exists' : msg)
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
    toast.success('Role updated')
    setChangeRoleTarget(null)
    setStaff(s => s.map(u => u.id === changeRoleTarget.id ? { ...u, role: newRole } : u))
  }

  const handleToggleActive = async (member: Profile) => {
    const next = !member.is_active
    const { error } = await supabase.from('profiles').update({ is_active: next }).eq('id', member.id)
    if (error) { toast.error('Failed to update account status'); return }
    toast.success(next ? `${member.full_name} reactivated` : `${member.full_name} deactivated`)
    setStaff(s => s.map(u => u.id === member.id ? { ...u, is_active: next } : u))
    setDeactivateTarget(null)
  }

  if (profile && profile.role !== 'gm' && profile.role !== 'system_admin') return null

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Admin Panel">
      <div className="flex flex-col gap-6 pb-12">

        {/* Page Actions */}
        <div className="flex items-center justify-end sm:justify-between">
          <p className="text-sm text-zinc-500 hidden sm:block">Manage staff accounts and view operations overview</p>
          {isSystemAdmin && (
            <Button onClick={() => setAddOpen(true)} className="bg-[#a31e22] text-white hover:bg-[#82181b] gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              Add Staff
            </Button>
          )}
        </div>

        <Tabs defaultValue={isSystemAdmin ? 'staff' : 'operations'}>
          <div className="w-full overflow-x-auto hide-scrollbar pb-1 -mb-1">
            <TabsList className="border border-zinc-200 bg-zinc-50 min-w-full justify-start sm:min-w-0 sm:justify-center">
              {isSystemAdmin && <TabsTrigger value="staff">Staff Management</TabsTrigger>}
              <TabsTrigger value="operations">Operations Overview</TabsTrigger>
            </TabsList>
          </div>

          {/* ══════════════ TAB 1: STAFF MANAGEMENT ══════════════ */}
          <TabsContent value="staff" className="space-y-6 mt-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { icon: Users, label: 'Active Staff', value: activeStaff.length, color: '#22c55e' },
                { icon: Building2, label: 'Departments', value: uniqueDepts, color: '#3b82f6' },
                { icon: ShieldCheck, label: 'Supervisors', value: supervisorCount, color: '#f59e0b' },
                { icon: UserX, label: 'Inactive Accounts', value: inactiveStaff.length, color: '#a1a1aa' },
              ].map(({ icon: Icon, label, value, color }) => (
                <Card key={label} className="relative overflow-hidden border-zinc-200 shadow-none">
                  <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
                  <CardContent className="p-4 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 mb-3">
                      <Icon className="h-4 w-4 text-zinc-600 shrink-0" />
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 truncate">{loadingStaff ? '—' : value}</p>
                    <p className="text-xs sm:text-sm text-zinc-500 truncate">{label}</p>
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
                      placeholder="Search staff..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {Object.entries(DEPT_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="gm">GM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loadingStaff ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                  </div>
                ) : pagedStaff.length === 0 ? (
                  <div className="py-12 text-center text-sm text-zinc-400">No staff found</div>
                ) : (
                  <>
                    <div className="divide-y divide-zinc-100">
                      {pagedStaff.map(member => (
                        <div key={member.id} className="flex items-center gap-3 py-3">
                          {/* Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a31e22] text-xs font-semibold text-white">
                            {getInitials(member.full_name)}
                          </div>

                          {/* Name + meta */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900">{member.full_name}</p>
                            <p className="truncate text-xs text-zinc-400">
                              {DEPT_LABELS[member.department]} · {formatDate(member.created_at)}
                            </p>
                          </div>

                          {/* Badges */}
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <Badge className={`${ROLE_BADGE[member.role]} shadow-none text-xs`}>
                              {ROLE_LABEL[member.role]}
                            </Badge>
                            <Badge className={`shadow-none text-xs border-transparent ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-400'}`}>
                              {member.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>

                          {/* Mobile: role badge only */}
                          <div className="flex sm:hidden shrink-0">
                            <Badge className={`${ROLE_BADGE[member.role]} shadow-none text-xs`}>
                              {ROLE_LABEL[member.role]}
                            </Badge>
                          </div>

                          {/* Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to="/dashboard" className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  View Entries
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setChangeRoleTarget(member); setNewRole(member.role) }}>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {member.is_active ? (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setDeactivateTarget(member)}
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-green-600 focus:text-green-600"
                                  onClick={() => handleToggleActive(member)}
                                >
                                  <Users className="mr-2 h-4 w-4" />
                                  Reactivate Account
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                        <span>
                          {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                            Previous
                          </Button>
                          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════ TAB 2: OPERATIONS OVERVIEW ══════════════ */}
          <TabsContent value="operations" className="space-y-6 mt-6">

            <div className="flex w-full overflow-x-auto hide-scrollbar gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {([['today', 'Today'], ['7days', '7 Days'], ['30days', '30 Days'], ['all', 'All Time']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDateRange(val)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                    dateRange === val ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingEntries ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
              </div>
            ) : (
              <>
                {/* Stat cards row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-500 mb-1">Total Entries</p>
                      <p className="text-4xl font-bold text-zinc-900">{filteredEntries.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-500 mb-1">Avg Resolution Time</p>
                      <p className="text-4xl font-bold text-zinc-900">{avgResolutionHours ?? '—'}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-zinc-200 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-500 mb-1">Most Active Dept</p>
                      <p className="text-2xl font-bold text-zinc-900">{mostActiveDept?.dept ?? '—'}</p>
                      {mostActiveDept && <p className="text-sm text-zinc-400 mt-1">{mostActiveDept.count} entries</p>}
                    </CardContent>
                  </Card>
                </div>

                {/* Charts row — stack on mobile, 2-col on sm+ */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* By department bar chart */}
                  <Card className="border-zinc-200 shadow-none min-w-0">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-500 mb-4">Entries by Department</p>
                      {deptChartData.length === 0 ? (
                        <p className="text-sm text-zinc-400">No data</p>
                      ) : (
                        <div className="w-full overflow-hidden">
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={deptChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <XAxis type="number" tick={{ fontSize: 11 }} />
                              <YAxis type="category" dataKey="dept" tick={{ fontSize: 11 }} width={80} />
                              <Tooltip cursor={{ fill: '#f4f4f5' }} />
                              <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* By status pie chart */}
                  <Card className="border-zinc-200 shadow-none min-w-0">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-zinc-500 mb-4">By Status</p>
                      {filteredEntries.length === 0 ? (
                        <p className="text-sm text-zinc-400">No data</p>
                      ) : (
                        <>
                          <div className="w-full overflow-hidden">
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie data={statusChartData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                                  {statusChartData.map((_, i) => (
                                    <Cell key={i} fill={STATUS_COLORS[i]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
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

                {/* By priority */}
                <Card className="border-zinc-200 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-zinc-500 mb-4">By Priority</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {priorityData.map(({ label, color, count }) => (
                        <div key={label} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-3 min-w-0">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-semibold text-zinc-900 truncate">{count}</p>
                            <p className="text-xs text-zinc-500 truncate">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent activity */}
                <Card className="border-zinc-200 shadow-none">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-700">Recent Activity</p>
                      <Link to="/dashboard">
                        <Button variant="ghost" size="sm" className="text-xs text-zinc-500">View All</Button>
                      </Link>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {entries.slice(0, 10).map(entry => (
                        <Link key={entry.id} to="/issues/$issueId" params={{ issueId: entry.id }} className="block py-3 hover:bg-zinc-50 -mx-4 px-4 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{entry.title}</p>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {DEPT_LABELS[entry.department]} · {formatTimeAgo(entry.created_at)}
                              </p>
                            </div>
                            <Badge className={`shrink-0 text-xs border-transparent shadow-none ${
                              entry.priority === 'urgent' ? 'bg-[#a31e22]/10 text-[#a31e22]' :
                              entry.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                              entry.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                              'bg-zinc-100 text-zinc-500'
                            }`}>
                              {entry.priority}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Add Staff Dialog ─────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) setAddError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Create a new staff account. They will receive login credentials.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input required value={newStaff.full_name} onChange={e => setNewStaff(s => ({ ...s, full_name: e.target.value }))} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input required type="email" value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))} placeholder="jane@trealhotel.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={newStaff.department} onValueChange={v => setNewStaff(s => ({ ...s, department: v as Department }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newStaff.role} onValueChange={v => setNewStaff(s => ({ ...s, role: v as Role }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="gm">GM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="relative">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  value={newStaff.password}
                  onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  placeholder="Min 8 characters"
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
              <p className="text-xs text-zinc-400">Staff member should change this on first login</p>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isAdding} className="bg-[#a31e22] text-white hover:bg-[#82181b]">
                {isAdding ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Change Role Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!changeRoleTarget} onOpenChange={open => { if (!open) setChangeRoleTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update {changeRoleTarget?.full_name}'s role</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              Current role:
              <Badge className={`${changeRoleTarget ? ROLE_BADGE[changeRoleTarget.role] : ''} shadow-none`}>
                {changeRoleTarget?.role}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="gm">GM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeRoleTarget(null)}>Cancel</Button>
            <Button disabled={isSavingRole || newRole === changeRoleTarget?.role} onClick={handleChangeRole} className="bg-[#a31e22] text-white hover:bg-[#82181b]">
              {isSavingRole ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Deactivate AlertDialog ───────────────────────────────────────── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={open => { if (!open) setDeactivateTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent <span className="font-medium">{deactivateTarget?.full_name}</span> from logging in. You can reactivate at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deactivateTarget && handleToggleActive(deactivateTarget)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
