import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/vantage/vantagelogo.png";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { image: 32, box: "h-8 w-8" },
  md: { image: 40, box: "h-10 w-10" },
  lg: { image: 56, box: "h-14 w-14" },
};

export function BrandLogo({
  className,
  imageClassName,
  showText = true,
  subtitle = "Owner dashboard",
  size = "md",
}: BrandLogoProps) {
  const { image, box } = sizes[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-steel-200",
          box,
        )}
      >
        <Image
          src={LOGO_SRC}
          alt="Vantage Home Movers"
          width={image}
          height={image}
          className={cn("object-contain p-1", imageClassName)}
          priority
        />
      </div>
      {showText ? (
        <div className="min-w-0">
          <p className="font-heading text-sm font-extrabold tracking-tight text-navy">Vantage Admin</p>
          {subtitle ? (
            <p className="truncate text-xs font-medium text-steel">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
