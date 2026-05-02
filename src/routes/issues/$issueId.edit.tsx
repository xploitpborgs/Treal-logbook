/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, Link } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/issues/$issueId/edit')({
  component: EditIssue,
})

function EditIssue() {
  const { issueId } = Route.useParams()

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
        <Link
          to="/issues/$issueId"
          params={{ issueId }}
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Issue
        </Link>

        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200">
          <p className="text-sm font-medium text-zinc-500">Edit issue — coming in a future phase</p>
          <Link to="/issues/$issueId" params={{ issueId }} className="mt-4">
            <Button variant="outline" size="sm">Return to Issue</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
