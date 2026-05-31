import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";
import { useUIStore } from "../../store";

// Localized labels for the prev/next/ellipsis controls. Kept in this
// primitive (rather than passed as props from every call site) so the
// whole app gets bilingual pagination for free.
function usePaginationLabels() {
  const isNepali = useUIStore((s) => s.locale === "ne");
  return {
    previous: isNepali ? "अघिल्लो" : "Previous",
    next: isNepali ? "अर्को" : "Next",
    morePages: isNepali ? "थप पृष्ठहरू" : "More pages",
    goPrevious: isNepali ? "अघिल्लो पृष्ठमा जानुहोस्" : "Go to previous page",
    goNext: isNepali ? "अर्को पृष्ठमा जानुहोस्" : "Go to next page",
  };
}

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<
  React.ComponentProps<"a">,
  "className" | "href" | "onClick" | "children"
>;

const PaginationLink = ({
  className,
  isActive,
  href,
  onClick,
  children,
}: PaginationLinkProps) => (
  <a
    href={href}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "default" : "outline",
        size: "icon",
      }),
      "h-9 w-9",
      className,
    )}
    onClick={onClick}
  >
    {children}
  </a>
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => {
  const labels = usePaginationLabels();
  return (
    <PaginationLink
      aria-label={labels.goPrevious}
      className={cn("gap-1 pl-2.5 w-auto px-3", className)}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>{labels.previous}</span>
    </PaginationLink>
  );
};
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => {
  const labels = usePaginationLabels();
  return (
    <PaginationLink
      aria-label={labels.goNext}
      className={cn("gap-1 pr-2.5 w-auto px-3", className)}
      {...props}
    >
      <span>{labels.next}</span>
      <ChevronRight className="h-4 w-4" />
    </PaginationLink>
  );
};
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => {
  const labels = usePaginationLabels();
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">{labels.morePages}</span>
    </span>
  );
};
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
