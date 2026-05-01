export function FullPageSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C41E3A] border-t-transparent" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    </div>
  )
}
