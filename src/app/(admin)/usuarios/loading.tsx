export default function UsuariosLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-36 rounded bg-slate-200 animate-pulse" />
      </div>

      <div className="mb-4 max-w-md">
        <div className="h-10 w-full rounded-xl bg-slate-100 animate-pulse" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-slate-50 border-b" />
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-12 border-b border-slate-50 flex items-center px-4 gap-4">
              <div className="h-4 bg-slate-100 rounded w-36" />
              <div className="h-4 bg-slate-100 rounded w-44" />
              <div className="h-5 bg-slate-100 rounded-full w-24" />
              <div className="h-4 bg-slate-100 rounded w-40" />
              <div className="h-4 bg-slate-100 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
