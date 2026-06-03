export default function AppLoadingScreen({ label = "Starting up" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_40%),linear-gradient(180deg,#111827_0%,#0f172a_100%)] px-4 text-neutral-100">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-neutral-950/75 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <div className="relative h-14 w-14">
            <div className="absolute left-2 top-0 h-8 w-1.5 rounded-full bg-amber-100/80 animate-[steam_1.8s_ease-in-out_infinite]" />
            <div className="absolute left-5 top-1 h-9 w-1.5 rounded-full bg-amber-100/70 animate-[steam_1.8s_ease-in-out_0.25s_infinite]" />
            <div className="absolute left-8 top-0.5 h-8 w-1.5 rounded-full bg-amber-100/60 animate-[steam_1.8s_ease-in-out_0.5s_infinite]" />
            <div className="absolute bottom-1 left-1/2 h-8 w-10 -translate-x-1/2 rounded-b-2xl rounded-t-md border-2 border-amber-100/80 bg-amber-100/10">
              <div className="absolute -right-3 top-2 h-4 w-4 rounded-full border-2 border-amber-100/80" />
              <div className="absolute left-1 right-1 top-2 h-2 rounded-full bg-amber-100/15" />
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Coffee is brewing...
          </h1>
          <p className="mt-2 text-sm text-neutral-400 sm:text-base">{label}</p>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-cyan-300 animate-[brew_1.8s_ease-in-out_infinite]" />
        </div>

        <style jsx>{`
          @keyframes steam {
            0%, 100% { transform: translateY(0); opacity: 0.25; }
            50% { transform: translateY(-10px); opacity: 1; }
          }

          @keyframes brew {
            0% { transform: translateX(-120%); }
            50% { transform: translateX(110%); }
            100% { transform: translateX(250%); }
          }
        `}</style>
      </div>
    </div>
  );
}
