import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import * as React from "react";

/**
 * Shared shell for the legal pages: breadcrumb, title, "last updated" line, a
 * standing demo disclaimer, and typographic styling applied to whatever plain
 * <h2>/<p>/<ul> the page passes as children (so each page stays readable prose).
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span className="px-2">/</span>
        <span className="text-foreground">{title}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          This is a demonstration storefront. The text below is a template for illustration only and
          is <strong className="font-medium text-foreground">not legal advice</strong> — have a
          qualified professional review and adapt it, and fill in the bracketed placeholders, before
          trading for real.
        </span>
      </div>

      <div className="mt-8 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-muted-foreground [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
