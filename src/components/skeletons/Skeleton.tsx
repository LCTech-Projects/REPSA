import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export const Skeleton = ({ className = "", ...props }: SkeletonProps) => (
  <div
    aria-hidden
    className={`animate-pulse rounded-md bg-grey-1 ${className}`.trim()}
    {...props}
  />
);
