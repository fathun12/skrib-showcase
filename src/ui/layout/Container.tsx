import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-300 px-4 md:px-8", className)}>
      {children}
    </div>
  );
}