import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

const alertVariants = cva("rounded-xl border p-4 flex gap-3", {
  variants: {
    variant: {
      default: "bg-slate-50 border-slate-200 text-slate-700",
      info: "bg-blue-50 border-blue-200 text-blue-800",
      success: "bg-emerald-50 border-emerald-200 text-emerald-800",
      warning: "bg-amber-50 border-amber-200 text-amber-800",
      error: "bg-red-50 border-red-200 text-red-800",
    },
  },
  defaultVariants: { variant: "default" },
});

const iconMap = {
  default: Info,
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof alertVariants> {
  title?: string;
}

function Alert({ className, variant = "default", title, children, ...props }: AlertProps) {
  const Icon = iconMap[variant || "default"];
  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert" {...props}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="space-y-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

export { Alert }; // exportamos el componente de alerta
