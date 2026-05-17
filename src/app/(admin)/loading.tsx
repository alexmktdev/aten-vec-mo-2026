export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 rounded bg-slate-100" style={{ width: `${85 - i * 8}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
