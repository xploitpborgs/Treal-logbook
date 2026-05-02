/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { departmentLabels, priorityLabels, statusLabels } from '@/lib/formatters'
import type { LogEntry, Priority, Status } from '@/types'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Search } from 'lucide-react'

export const Route = createFileRoute('/issues/')({
  component: AllIssuesPage,
})

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-[#C41E3A]',
  high:   'bg-amber-500',
  medium: 'bg-blue-500',
  low:    'bg-zinc-400',
}

const STATUS_STYLE: Record<string, string> = {
  open:        'bg-zinc-100 text-zinc-600 border-transparent',
  in_progress: 'bg-amber-100 text-amber-700 border-transparent',
  resolved:    'bg-green-100 text-green-700 border-transparent',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function shortTime(d: string) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function exportCSV(entries: LogEntry[]) {
  const headers = ['Date', 'Title', 'Department', 'Priority', 'Status', 'Author']
  const rows = entries.map(e => [
    `${shortDate(e.created_at)} ${shortTime(e.created_at)}`,
    `"${e.title.replace(/"/g, '""')}"`,
    departmentLabels[e.department] ?? e.department,
    e.priority,
    e.status,
    `"${(e.author?.full_name ?? '').replace(/"/g, '""')}"`,
  ])
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `treal-issues-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function AllIssuesPage() {
  const [entries, setEntries]     = useState<LogEntry[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [page, setPage]           = useState(0)
  const [sortDir, setSortDir]     = useState<SortDir>('desc')
  const [sortField, setSortField] = useState<'created_at' | 'priority'>('created_at')
  const [search, setSearch]       = useState('')
  const [department, setDept]     = useState('all')
  const [priority, setPriority]   = useState('all')
  const [status, setStatus]       = useState('all')

  const buildQuery = useCallback((forExport = false) => {
    let q = supabase
      .from('log_entries')
      .select('*, author:profiles!author_id(id, full_name, department)', { count: 'exact' })

    if (department !== 'all') q = q.eq('department', department)
    if (priority   !== 'all') q = q.eq('priority', priority)
    if (status     !== 'all') q = q.eq('status', status)
    if (search.trim())        q = q.ilike('title', `%${search.trim()}%`)

    q = q.order('created_at', { ascending: sortField === 'created_at' ? sortDir === 'asc' : false })

    if (!forExport) q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    return q
  }, [department, priority, status, search, sortField, sortDir, page])

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    const { data, count, error } = await buildQuery()
    if (!error && data) {
      let rows = data as unknown as LogEntry[]
      if (sortField === 'priority') {
        rows = [...rows].sort((a, b) =>
          sortDir === 'asc'
            ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
            : PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority],
        )
      }
      setEntries(rows)
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [buildQuery, sortField, sortDir])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0) }, [search, department, priority, status, sortField, sortDir])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchIssues() }, [fetchIssues])

  const handleSort = (field: 'created_at' | 'priority') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const handleExport = async () => {
    setExporting(true)
    const { data, error } = await buildQuery(true)
    if (!error && data) exportCSV(data as unknown as LogEntry[])
    setExporting(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const SortIcon = ({ field }: { field: 'created_at' | 'priority' }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-zinc-400" />
    return sortDir === 'asc'
      ? <ArrowUp   className="ml-1 h-3 w-3 text-zinc-700" />
      : <ArrowDown className="ml-1 h-3 w-3 text-zinc-700" />
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 pb-12">

        {/* Heading */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">All Issues</h1>
            <p className="mt-0.5 text-sm text-zinc-500 hidden sm:block">
              {total > 0 ? `${total.toLocaleString()} issues` : 'Full logbook record'}
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="shrink-0 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export CSV'}</span>
          </Button>
        </div>

        {/* Filter strip */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search by title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={department} onValueChange={setDept}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Dept" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {Object.entries(departmentLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {Object.entries(priorityLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                  <TableHead className="w-6 pl-4" />
                  <TableHead className="min-w-[260px]">Title</TableHead>
                  <TableHead className="hidden md:table-cell w-[130px]">Department</TableHead>
                  <TableHead className="hidden sm:table-cell w-[130px]">Author</TableHead>
                  <TableHead className="w-[110px]">
                    <button onClick={() => handleSort('priority')} className="flex items-center font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
                      Priority <SortIcon field="priority" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[110px]">
                    <button onClick={() => handleSort('created_at')} className="flex items-center font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
                      Date <SortIcon field="created_at" />
                    </button>
                  </TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="py-2">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center text-sm text-zinc-400">
                      No issues match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map(entry => (
                    <TableRow
                      key={entry.id}
                      className="group cursor-pointer hover:bg-zinc-50"
                      onClick={() => window.location.href = `/issues/${entry.id}`}
                    >
                      <TableCell className="pl-4 py-2.5">
                        <div className={`h-2 w-2 rounded-full ${PRIORITY_DOT[entry.priority] ?? 'bg-zinc-300'}`} />
                      </TableCell>
                      <TableCell className="py-2.5 font-medium text-zinc-900 max-w-[260px]">
                        <p className="truncate text-sm">{entry.title}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5 text-xs text-zinc-500">
                        {departmentLabels[entry.department] ?? entry.department}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2.5 text-xs text-zinc-500">
                        <span className="truncate block max-w-[120px]">{entry.author?.full_name ?? '—'}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className={`text-xs font-medium ${
                          entry.priority === 'urgent' ? 'text-[#C41E3A]' :
                          entry.priority === 'high'   ? 'text-amber-600' :
                          entry.priority === 'medium' ? 'text-blue-600'  :
                          'text-zinc-400'
                        }`}>
                          {priorityLabels[entry.priority as Priority]}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge className={`text-xs shadow-none ${STATUS_STYLE[entry.status] ?? ''}`}>
                          {statusLabels[entry.status as Status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-zinc-400 whitespace-nowrap">
                        <p>{shortDate(entry.created_at)}</p>
                        <p>{shortTime(entry.created_at)}</p>
                      </TableCell>
                      <TableCell className="py-2.5 pr-3">
                        <Link
                          to="/issues/$issueId"
                          params={{ issueId: entry.id }}
                          onClick={e => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-700" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-xs text-zinc-400">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
