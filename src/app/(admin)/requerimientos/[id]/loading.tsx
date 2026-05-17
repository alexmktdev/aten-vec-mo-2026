export default function RequerimientoDetalleLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-20 rounded bg-slate-100" />
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-6 w-24 rounded-full bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-36 rounded bg-slate-100 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i}>
                  <div className="h-3 w-16 rounded bg-slate-50 mb-1" />
                  <div className="h-4 w-32 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-48 rounded bg-slate-100 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i}>
                  <div className="h-3 w-24 rounded bg-slate-50 mb-1" />
                  <div className="h-4 w-36 rounded bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="h-3 w-20 rounded bg-slate-50 mb-1" />
            <div className="h-16 w-full rounded bg-slate-100" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-40 rounded bg-slate-100 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-200 mt-2" />
                  <div>
                    <div className="h-4 w-28 rounded bg-slate-100 mb-1" />
                    <div className="h-3 w-36 rounded bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-24 rounded bg-slate-100 mb-4" />
            <div className="space-y-4">
              <div className="h-10 w-full rounded bg-slate-100" />
              <div className="h-20 w-full rounded bg-slate-100" />
              <div className="h-10 w-full rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
