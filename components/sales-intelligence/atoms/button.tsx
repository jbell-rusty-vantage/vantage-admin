import { Button as HostButton, type ButtonProps as HostButtonProps } from "@/components/ui/button";
import { cx } from "../lib/format";

export type SiButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";

const hostVariant: Record<SiButtonVariant, HostButtonProps["variant"]> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
  link: "ghost",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: Omit<HostButtonProps, "variant"> & { variant?: SiButtonVariant; size?: "sm" | "md" }) {
  return (
    <HostButton
      variant={hostVariant[variant]}
      className={cx("si-btn", `si-btn--${variant}`, `si-btn--${size}`, className)}
      {...props}
    />
  );
}
