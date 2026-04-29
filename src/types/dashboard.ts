import type { Department, Priority, Status, Shift, Category } from '@/types'

export interface FilterState {
  search: string
  department: Department | 'all'
  priority: Priority | 'all'
  status: Status | 'all'
  shift: Shift | 'all'
  category: Category | 'all'
  dateGroup: 'today' | '7days' | '30days' | 'all'
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  department: 'all',
  priority: 'all',
  status: 'all',
  shift: 'all',
  category: 'all',
  dateGroup: 'today',
}
