import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn, debounce } from '@/lib/utils'

export type FeedRange = 'today' | '7days' | '30days' | 'alltime'

export interface FeedFilters {
  search:   string
  type:     'all' | 'gm' | 'hr' | 'supervisor' | 'staff'
  priority: 'all' | 'low' | 'medium' | 'high' | 'urgent'
  range:    FeedRange
}

export const DEFAULT_FEED_FILTERS: FeedFilters = {
  search:   '',
  type:     'all',
  priority: 'all',
  range:    'today',
}

const TYPE_OPTIONS = [
  { value: 'gm',         label: 'GM Update'        },
  { value: 'hr',         label: 'HR Update'         },
  { value: 'supervisor', label: 'Supervisor Update' },
  { value: 'staff',      label: 'Staff Update'      },
]

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low'    },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High'   },
  { value: 'urgent', label: 'Urgent' },
]

const DATE_GROUPS: { value: FeedRange; label: string }[] = [
  { value: 'today',   label: 'Today'    },
  { value: '7days',   label: '7 Days'   },
  { value: '30days',  label: '30 Days'  },
  { value: 'alltime', label: 'All Time' },
]

interface FeedFilterBarProps {
  filters: FeedFilters
  onChange: (next: Partial<FeedFilters>) => void
  availableTypes?: Array<'gm' | 'hr' | 'supervisor' | 'staff'>
}

export function FeedFilterBar({ filters, onChange, availableTypes }: FeedFilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search)

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  const debouncedSearch = useRef(
    debounce((v: string) => onChangeRef.current({ search: v }), 300)
  ).current

  useEffect(() => { setSearchInput(filters.search) }, [filters.search])

  const typeOptions = availableTypes
    ? TYPE_OPTIONS.filter(o => availableTypes.includes(o.value as 'gm' | 'hr' | 'supervisor' | 'staff'))
    : TYPE_OPTIONS

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search updates…"
          value={searchInput}
          onChange={e => { setSearchInput(e.target.value); debouncedSearch(e.target.value) }}
          className="pl-9 h-10 rounded-lg border-zinc-200 bg-white text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FeedPillSelect
          value={filters.type}
          onValueChange={v => onChange({ type: v as FeedFilters['type'] })}
          allLabel="All Types"
          options={typeOptions}
        />
        <FeedPillSelect
          value={filters.priority}
          onValueChange={v => onChange({ priority: v as FeedFilters['priority'] })}
          allLabel="All Priorities"
          options={PRIORITY_OPTIONS}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 w-fit min-w-full sm:min-w-0">
          {DATE_GROUPS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ range: value })}
              className={cn(
                'flex-1 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filters.range === value
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function applyFeedFilters<T extends {
  created_at: string
  type?: string
  priority?: string
  title?: string
  body?: string
}>(items: T[], filters: FeedFilters): T[] {
  return items.filter(u => {
    if (filters.type !== 'all' && u.type !== filters.type) return false
    if (filters.priority !== 'all' && u.priority !== filters.priority) return false
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      if (!(u.title ?? '').toLowerCase().includes(q) && !(u.body ?? '').toLowerCase().includes(q)) return false
    }
    if (filters.range !== 'alltime') {
      let cutoff: number
      if (filters.range === 'today') {
        const s = new Date(); s.setHours(0, 0, 0, 0); cutoff = s.getTime()
      } else {
        cutoff = Date.now() - (filters.range === '7days' ? 7 : 30) * 86400000
      }
      if (new Date(u.created_at).getTime() < cutoff) return false
    }
    return true
  })
}

interface FeedPillSelectProps {
  value: string
  onValueChange: (v: string) => void
  allLabel: string
  options: { value: string; label: string }[]
}

function FeedPillSelect({ value, onValueChange, allLabel, options }: FeedPillSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 w-auto min-w-[120px] hover:bg-zinc-50 focus:ring-0 focus:ring-offset-0 shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
