import type { LogEntry } from '@/types'

interface StatsCardsProps {
  entries: LogEntry[]
}

interface StatCard {
  label: string
  value: number
  borderClass: string
  description: string
}

export function StatsCards({ entries }: StatsCardsProps) {
  const open       = entries.filter(e => e.status === 'open').length
  const inProgress = entries.filter(e => e.status === 'in_progress').length
  const urgent     = entries.filter(e => e.priority === 'urgent').length
  const resolved   = entries.filter(e => e.status === 'resolved').length

  const cards: StatCard[] = [
    { label: 'Open',        value: open,       borderClass: 'border-l-blue-500',   description: 'Awaiting action' },
    { label: 'In Progress', value: inProgress, borderClass: 'border-l-amber-500',  description: 'Being handled' },
    { label: 'Urgent',      value: urgent,     borderClass: 'border-l-[#C41E3A]',  description: 'High priority' },
    { label: 'Resolved',    value: resolved,   borderClass: 'border-l-green-500',  description: 'Completed today' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(card => (
        <div
          key={card.label}
          className={`relative overflow-hidden rounded-lg border border-zinc-200 border-l-4 bg-white p-5 ${card.borderClass}`}
        >
          <p className="text-sm font-medium text-zinc-500">{card.label}</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{card.value}</p>
          <p className="mt-1 text-xs text-zinc-400">{card.description}</p>
        </div>
      ))}
    </div>
  )
}

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-zinc-200 border-l-4 border-l-zinc-200 bg-white p-5"
        >
          <div className="h-4 w-16 rounded bg-zinc-200" />
          <div className="mt-2 h-8 w-10 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-24 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}
