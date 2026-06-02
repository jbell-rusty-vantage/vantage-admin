import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive" | "gold";

const variants: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-white shadow-[0_6px_16px_rgba(20,93,160,0.28)] hover:bg-navy hover:text-white hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(6,43,85,0.30)] active:translate-y-0",
  outline:
    "border border-steel-200 bg-white text-navy shadow-sm hover:border-trust-blue/30 hover:bg-steel-100",
  ghost: "text-navy hover:bg-steel-100",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  gold: "bg-gold text-navy shadow-[0_6px_16px_rgba(244,180,0,0.32)] hover:bg-[#e0a500] hover:-translate-y-0.5 active:translate-y-0",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md px-4 py-2",
        "font-heading text-sm font-bold uppercase tracking-wide transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
