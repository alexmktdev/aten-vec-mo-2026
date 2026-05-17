export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-2 xl:px-4">
      <div className="h-8 w-[480px] max-w-full rounded bg-slate-200 animate-pulse mb-2" />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-sm animate-pulse border border-slate-100">
            <div className="mb-3 h-4 w-28 rounded bg-slate-100" />
            <div className="h-9 w-16 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-40 rounded bg-slate-50" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="h-5 w-52 rounded bg-slate-100 mb-3" />
            <div className="h-3 w-40 rounded bg-slate-50 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="rounded-xl border border-slate-200 bg-slate-50 p-3 h-16" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="h-5 w-64 rounded bg-slate-100 mb-3" />
            <div className="h-3 w-48 rounded bg-slate-50 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 h-12" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
