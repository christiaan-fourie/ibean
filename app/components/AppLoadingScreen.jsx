export default function AppLoadingScreen({ label = "Loading" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900 px-4 text-neutral-100">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-2xl backdrop-blur-xl md:p-6">
        <div className="grid min-h-[70vh] grid-cols-[68px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10">
          <div className="border-r border-white/10 bg-neutral-950/70 p-2">
            <div className="mb-3 flex h-10 items-center justify-center rounded-2xl bg-white/5">
              <div className="h-5 w-5 rounded-md bg-white/20 animate-pulse" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={`nav-skeleton-${index}`} className="mx-auto h-10 w-10 rounded-2xl bg-white/10 animate-pulse" />
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-col bg-neutral-900/60">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <div className="h-5 w-28 rounded bg-white/15 animate-pulse" />
              <div className="h-8 w-32 rounded-2xl bg-white/10 animate-pulse" />
              <div className="h-8 w-24 rounded-2xl bg-white/10 animate-pulse" />
            </div>

            <div className="grid flex-1 min-h-0 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-white/10 bg-neutral-800/40 p-3">
                <div className="mb-3 h-10 w-full rounded-2xl bg-white/10 animate-pulse" />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={`card-skeleton-${index}`} className="h-24 rounded-xl bg-white/10 animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-neutral-800/40 p-3">
                <div className="mb-3 h-5 w-32 rounded bg-white/15 animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={`line-skeleton-${index}`} className="h-10 rounded-xl bg-white/10 animate-pulse" />
                  ))}
                </div>
                <div className="mt-4 h-11 rounded-xl bg-blue-500/50 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <p className="pt-3 text-center text-sm text-neutral-400">{label}...</p>
      </div>
    </div>
  );
}
