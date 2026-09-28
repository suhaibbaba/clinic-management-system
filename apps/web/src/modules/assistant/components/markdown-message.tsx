import type { ComponentPropsWithoutRef, JSX, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@clinic/ui/lib/cn";

export function MarkdownMessage({
  content,
  "data-testid": testId,
}: {
  readonly content: string;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  return (
    <div
      data-part="markdown"
      {...(testId !== undefined && { "data-testid": testId })}
      className="flex flex-col gap-3"
    >
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </Markdown>
    </div>
  );
}

type Props<TTag extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<TTag> & {
  readonly children?: ReactNode;
};

const BLOCK = "[unicode-bidi:plaintext]";

const CODE = "rounded-chip bg-inset px-1.5 py-0.5 text-meta text-ink";

const COMPONENTS = {
  p: ({ children }: Props<"p">) => <p className={cn(BLOCK, "text-value text-ink")}>{children}</p>,

  strong: ({ children }: Props<"strong">) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),

  em: ({ children }: Props<"em">) => <em className="italic">{children}</em>,

  ul: ({ children }: Props<"ul">) => (
    <ul className={cn(BLOCK, "flex list-disc flex-col gap-1 ps-5 text-value text-ink")}>
      {children}
    </ul>
  ),

  ol: ({ children }: Props<"ol">) => (
    <ol className={cn(BLOCK, "flex list-decimal flex-col gap-1 ps-5 text-value text-ink")}>
      {children}
    </ol>
  ),

  li: ({ children }: Props<"li">) => <li className="marker:text-ink-faint">{children}</li>,

  a: ({ children, href }: Props<"a">) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary-600 underline underline-offset-2 hover:text-primary-700"
    >
      {children}
    </a>
  ),

  code: ({ children, className }: Props<"code">) => (
    <code dir="ltr" className={cn(className === undefined && CODE, "inline-block")}>
      {children}
    </code>
  ),

  pre: ({ children }: Props<"pre">) => (
    <pre
      dir="ltr"
      className="overflow-x-auto rounded-field bg-inset p-3 text-start text-meta text-ink"
    >
      {children}
    </pre>
  ),

  blockquote: ({ children }: Props<"blockquote">) => (
    <blockquote
      className={cn(BLOCK, "border-s-2 border-line-strong ps-3 text-value text-ink-muted")}
    >
      {children}
    </blockquote>
  ),

  h1: ({ children }: Props<"h1">) => (
    <h3 className={cn(BLOCK, "text-section font-semibold")}>{children}</h3>
  ),
  h2: ({ children }: Props<"h2">) => (
    <h3 className={cn(BLOCK, "text-section font-semibold")}>{children}</h3>
  ),
  h3: ({ children }: Props<"h3">) => (
    <h4 className={cn(BLOCK, "text-value font-semibold")}>{children}</h4>
  ),

  hr: () => <hr className="border-line" />,

  table: ({ children }: Props<"table">) => (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-start text-meta">{children}</table>
    </div>
  ),

  thead: ({ children }: Props<"thead">) => <thead className="bg-table-head">{children}</thead>,

  th: ({ children }: Props<"th">) => (
    <th
      className={cn(
        BLOCK,
        "border border-line px-2.5 py-1.5 text-start font-semibold text-ink-muted",
      )}
    >
      {children}
    </th>
  ),

  td: ({ children }: Props<"td">) => (
    <td className={cn(BLOCK, "border border-line px-2.5 py-1.5 text-start text-ink")}>
      {children}
    </td>
  ),
};
