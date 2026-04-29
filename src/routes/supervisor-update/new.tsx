import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'

export const Route = createFileRoute('/supervisor-update/new')({
  component: SupervisorUpdateNew,
})

function SupervisorUpdateNew() {
  return (
    <AppLayout>
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200">
        <p className="text-sm font-medium text-zinc-500">Post Supervisor Update</p>
        <p className="mt-1 text-xs text-zinc-400">Coming in Phase B</p>
      </div>
    </AppLayout>
  )
}
