import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DEPT_LABELS, PRIORITY_LABELS, STATUS_LABELS, SHIFT_LABELS } from '@/lib/constants'
import type { FilterState } from '@/types/dashboard'
import type { Department, Priority, Status, Shift } from '@/types'

interface FilterBarProps {
  filters: FilterState
  onChange: (next: Partial<FilterState>) => void
  hideDepartment?: boolean
}

const DATE_GROUPS: { value: FilterState['dateGroup']; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: 'all', label: 'All Time' },
]

export function FilterBar({ filters, onChange, hideDepartment }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search entries…"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Dropdowns — 2 columns on mobile, inline on sm+ */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {!hideDepartment && (
          <FilterSelect
            value={filters.department}
            onValueChange={v => onChange({ department: v as Department | 'all' })}
            placeholder="Department"
            options={Object.entries(DEPT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        )}
        <FilterSelect
          value={filters.priority}
          onValueChange={v => onChange({ priority: v as Priority | 'all' })}
          placeholder="Priority"
          options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
        <FilterSelect
          value={filters.status}
          onValueChange={v => onChange({ status: v as Status | 'all' })}
          placeholder="Status"
          options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
        <FilterSelect
          value={filters.shift}
          onValueChange={v => onChange({ shift: v as Shift | 'all' })}
          placeholder="Shift"
          options={Object.entries(SHIFT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
      </div>

      {/* Date group pills — scrollable on mobile */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 w-fit min-w-full sm:min-w-0">
          {DATE_GROUPS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ dateGroup: value })}
              className={cn(
                'flex-1 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filters.dateGroup === value
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

interface FilterSelectProps {
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
}

function FilterSelect({ value, onValueChange, placeholder, options }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-full text-xs sm:w-[130px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {placeholder}s</SelectItem>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
