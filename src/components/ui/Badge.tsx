import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight transition-colors",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700",
        yellow: "bg-yellow-100 text-yellow-800 border border-yellow-200",
        blue: "bg-blue-100 text-blue-800 border border-blue-200",
        orange: "bg-orange-100 text-orange-800 border border-orange-200",
        green: "bg-emerald-100 text-emerald-800 border border-emerald-200",
        red: "bg-red-100 text-red-800 border border-red-200",
        purple: "bg-purple-100 text-purple-800 border border-purple-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
