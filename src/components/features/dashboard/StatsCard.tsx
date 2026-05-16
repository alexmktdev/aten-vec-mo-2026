import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
  trend?: string;
}

export function StatsCard({ title, value, icon: Icon, color = "blue", trend }: Props) {
  const colorClasses: Record<string, { top: string; value: string; icon: string; iconBg: string }> = {
    blue: { top: "border-t-blue-400", value: "text-slate-800", icon: "text-blue-700", iconBg: "bg-slate-100" },
    green: { top: "border-t-emerald-400", value: "text-slate-800", icon: "text-emerald-700", iconBg: "bg-slate-100" },
    yellow: { top: "border-t-amber-400", value: "text-slate-800", icon: "text-amber-700", iconBg: "bg-slate-100" },
    red: { top: "border-t-rose-400", value: "text-slate-800", icon: "text-rose-700", iconBg: "bg-slate-100" },
    orange: { top: "border-t-orange-400", value: "text-slate-800", icon: "text-orange-700", iconBg: "bg-slate-100" },
    purple: { top: "border-t-violet-400", value: "text-slate-800", icon: "text-violet-700", iconBg: "bg-slate-100" },
  };
  const c = colorClasses[color] || colorClasses.blue;

  return (
    <Card className={cn("h-full min-h-[118px] border border-slate-200 border-t-[3px] rounded-xl shadow-sm hover:shadow-md transition-shadow", c.top)}>
      <CardContent className="h-full p-3.5">
        <div className="h-full flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-slate-700">{title}</p>
            <p className={cn("text-[28px] font-bold mt-2.5 leading-none tracking-tight", c.value)}>{value}</p>
            {trend && <p className="text-[11px] text-slate-500 mt-1.5">{trend}</p>}
          </div>
          <div className={cn("p-1.5 rounded-md", c.iconBg)}>
            <Icon className={cn("h-3.5 w-3.5", c.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
