import Link from "next/link";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border py-8 [html[data-focus=true]_&]:hidden">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Skrib. A calm place to read and write.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <a
              href="/feed.xml"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              RSS
            </a>
          </nav>
        </div>
      </Container>
    </footer>
  );
}