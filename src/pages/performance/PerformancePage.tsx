import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDepartment } from '@/lib/formatters'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { LogEntry } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import {
  TrendingUp, Users, CheckCircle2, AlertTriangle,
  Clock, Award, Activity, LayoutGrid
} from 'lucide-react'

const STATUS_COLORS = {
  open: '#a1a1aa',
  in_progress: '#f59e0b',
  resolved: '#22c55e'
}

const CHART_COLORS = ['#C41E3A', '#3b82f6', '#f59e0b', '#7c3aed', '#22c55e', '#ec4899', '#06b6d4']

export function PerformancePage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('7days')
  const [drillDown, setDrillDown] = useState<{ type: 'dept' | 'status' | null, value: string | null }>({ type: null, value: null })
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('log_entries')
      .select('*, author:profiles!author_id(full_name, department)')
      .order('created_at', { ascending: false })

    if (data) setEntries(data as unknown as LogEntry[])
    setLoading(false)
  }

  const filteredEntries = useMemo(() => {
    const now = Date.now()
    return entries.filter(e => {
      const t = new Date(e.created_at).getTime()
      if (timeRange === '7days') return now - t <= 7 * 86400000
      if (timeRange === '30days') return now - t <= 30 * 86400000
      return true
    })
  }, [entries, timeRange])

  // ─── Metrics ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = filteredEntries.length
    const resolved = filteredEntries.filter(e => e.status === 'resolved').length
    const escalated = filteredEntries.filter(e => e.is_escalated).length
    const urgent = filteredEntries.filter(e => e.priority === 'urgent').length
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0
    const escalationRate = total > 0 ? Math.round((escalated / total) * 100) : 0

    // Avg resolution time
    const resolvedWithTime = filteredEntries.filter(e => e.status === 'resolved' && e.resolved_at)
    let avgResolution = '—'
    if (resolvedWithTime.length > 0) {
      const avgMs = resolvedWithTime.reduce((acc, e) =>
        acc + (new Date(e.resolved_at!).getTime() - new Date(e.created_at).getTime()), 0
      ) / resolvedWithTime.length
      const hours = avgMs / 3600000
      avgResolution = hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`
    }

    return { total, resolved, escalated, urgent, resolutionRate, escalationRate, avgResolution }
  }, [filteredEntries])

  // ─── Chart Data ──────────────────────────────────────────────────────────

  const deptData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredEntries.forEach(e => {
      const label = formatDepartment(e.department)
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredEntries])

  const statusData = useMemo(() => [
    { name: 'Open', value: filteredEntries.filter(e => e.status === 'open').length },
    { name: 'In Progress', value: filteredEntries.filter(e => e.status === 'in_progress').length },
    { name: 'Resolved', value: filteredEntries.filter(e => e.status === 'resolved').length },
  ], [filteredEntries])

  const trendData = useMemo(() => {
    const days: Record<string, { total: number; resolved: number }> = {}
    filteredEntries.forEach(e => {
      const day = e.created_at.split('T')[0]
      if (!days[day]) days[day] = { total: 0, resolved: 0 }
      days[day].total++
      if (e.status === 'resolved') days[day].resolved++
    })
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        ...data
      }))
  }, [filteredEntries])

  const topStaff = useMemo(() => {
    const staff: Record<string, { name: string; count: number; dept: string }> = {}
    filteredEntries.filter(e => e.status === 'resolved' && e.resolver).forEach(e => {
      const id = e.resolved_by!
      if (!staff[id]) staff[id] = { name: e.resolver?.full_name ?? 'Unknown', count: 0, dept: e.department }
      staff[id].count++
    })
    return Object.values(staff).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [filteredEntries])

  const drillDownEntries = useMemo(() => {
    if (!drillDown.type || !drillDown.value) return []
    
    return filteredEntries.filter(e => {
      if (drillDown.type === 'dept') {
        return formatDepartment(e.department) === drillDown.value
      }
      if (drillDown.type === 'status') {
        const statusMap: Record<string, string> = { 'Open': 'open', 'In Progress': 'in_progress', 'Resolved': 'resolved' }
        return e.status === statusMap[drillDown.value!]
      }
      return false
    })
  }, [filteredEntries, drillDown])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-[#C41E3A]" />
            Hotel Performance
          </h1>
          <p className="text-zinc-500 mt-1">Operational insights and efficiency metrics for Treal Hotels & Suites.</p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
          {(['7days', '30days', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                timeRange === range
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Issues"
          value={stats.total}
          icon={Activity}
          color="#a1a1aa"
        />
        <MetricCard
          title="Resolution Rate"
          value={`${stats.resolutionRate}%`}
          icon={CheckCircle2}
          color="#22c55e"
        />
        <MetricCard
          title="Escalation Rate"
          value={`${stats.escalationRate}%`}
          icon={AlertTriangle}
          color="#C41E3A"
        />
        <MetricCard
          title="Avg. Resolution"
          value={stats.avgResolution}
          icon={Clock}
          color="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Trend */}
        <Card className="shadow-md border-zinc-200 overflow-hidden">
          <CardHeader className="border-b border-zinc-50 bg-zinc-50/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#C41E3A]" />
              Issue Activity Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Line type="monotone" dataKey="total" name="New Issues" stroke="#C41E3A" strokeWidth={3} dot={{ r: 4, fill: '#C41E3A' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={3} dot={{ r: 4, fill: '#22c55e' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card className="shadow-md border-zinc-200 overflow-hidden">
          <CardHeader className="border-b border-zinc-50 bg-zinc-50/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-blue-600" />
              Department Load
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} width={100} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7' }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => setDrillDown({ type: 'dept', value: data.name ?? null })}
                    className="cursor-pointer"
                  >
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card className="shadow-md border-zinc-200 col-span-1">
          <CardHeader className="border-b border-zinc-50 bg-zinc-50/50">
            <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      onClick={(data) => setDrillDown({ type: 'status', value: data.name ?? null })}
                      className="cursor-pointer"
                    >
                      <Cell fill={STATUS_COLORS.open} className="hover:opacity-80" />
                      <Cell fill={STATUS_COLORS.in_progress} className="hover:opacity-80" />
                      <Cell fill={STATUS_COLORS.resolved} className="hover:opacity-80" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {statusData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: Object.values(STATUS_COLORS)[i] }} />
                    <span className="text-zinc-600">{d.name}</span>
                  </div>
                  <span className="font-semibold text-zinc-900">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers (Resolvers) */}
        <Card className="shadow-md border-zinc-200 col-span-2">
          <CardHeader className="border-b border-zinc-50 bg-zinc-50/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Efficiency Leaders (Most Resolved)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {topStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-zinc-400">
                <Users className="h-8 w-8 mb-2 opacity-20" />
                <p>No resolution data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topStaff.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-100 transition-hover hover:border-[#C41E3A]/20">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C41E3A] text-white font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900">{s.name}</p>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">{formatDepartment(s.dept)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-[#C41E3A]">{s.count}</p>
                      <p className="text-xs text-zinc-500">Issues Resolved</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Section */}
      {drillDown.value && (
        <Card className="border-[#C41E3A]/20 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="bg-zinc-50/80 border-b border-zinc-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#C41E3A]" />
                Drill-down: {drillDown.value}
              </CardTitle>
              <p className="text-xs text-zinc-500 mt-1">Showing {drillDownEntries.length} underlying issues</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDrillDown({ type: null, value: null })}
              className="text-zinc-400 hover:text-zinc-900"
            >
              Clear Filter
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto">
              {drillDownEntries.map((e) => (
                <div key={e.id} className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0 h-4 border-zinc-300">
                        {formatDepartment(e.department)}
                      </Badge>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(e.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 truncate">{e.title}</p>
                    <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{e.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                    <div className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      e.status === 'resolved' ? "bg-green-50 text-green-700 border-green-200" :
                      e.status === 'in_progress' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                    )}>
                      {e.status.replace('_', ' ')}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigate({ to: `/dashboard` as any })}>
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="border-zinc-200 shadow-none hover:bg-zinc-50/50 transition-colors">
      <CardContent className="p-4 flex items-center gap-3">
        <div 
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" 
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-zinc-900 leading-tight">{value}</p>
          <p className="text-xs text-zinc-500 truncate font-medium">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}
