import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ArticleBodyProps = {
  children: ReactNode;
  className?: string;
};

export function ArticleBody({ children, className }: ArticleBodyProps) {
  return <div className={cn("prose-article", className)}>{children}</div>;
}