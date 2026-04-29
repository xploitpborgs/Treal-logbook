import { createFileRoute, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/entries/$id/edit')({
  component: EditEntry,
})

function EditEntry() {
  const { id } = Route.useParams()

  return (
    <AppLayout title="Edit Entry">
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
        <Link
          to="/entries/$id"
          params={{ id }}
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Entry
        </Link>

        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200">
          <p className="text-sm font-medium text-zinc-500">Edit entry coming in Phase 8</p>
          <Link to="/entries/$id" params={{ id }} className="mt-4">
            <Button variant="outline" size="sm">Return to Entry</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
