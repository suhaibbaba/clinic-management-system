import type { JSX, ReactNode } from 'react';

import { Badge, type BadgeTone } from '@web/components/ui/badge';
import { Icon, type IconName } from '@web/components/ui/icon';
import { ProgressBar, type ProgressTone } from '@web/components/ui/progress-bar';
import { cn } from '@web/lib/cn';

export interface EntityCardMeta {
  readonly label: string;
  readonly value: ReactNode;
  /** Latin values — money, dates, file numbers — stay left-to-right. */
  readonly ltr?: boolean | undefined;
}

export interface EntityCardProps {
  readonly icon: IconName;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly status?: { readonly label: string; readonly tone: BadgeTone } | undefined;
  readonly progress?:
    | {
        readonly value: number;
        readonly total: number;
        readonly label: string;
        readonly caption?: string | undefined;
        readonly tone?: ProgressTone | undefined;
      }
    | undefined;
  readonly meta?: readonly EntityCardMeta[] | undefined;
  readonly action?:
    | {
        /** The button's accessible name — the icon alone says nothing. */
        readonly label: string;
        readonly onClick: () => void;
        /** Defaults to the "forward" chevron, which in Arabic points left. */
        readonly icon?: IconName | undefined;
        readonly disabled?: boolean | undefined;
      }
    | undefined;
  readonly isSelected?: boolean | undefined;
  readonly className?: string | undefined;
  /** Extra content between the progress bar and the meta row. */
  readonly children?: ReactNode | undefined;
}

/**
 * The repeating card for anything that has a name, a state and a sense of
 * progress: a treatment plan, a lab order, a stocked item.
 *
 * They are one component rather than three lookalikes because the shape is the
 * point — a clinic manager glancing at a grid should read "how far along" the
 * same way whatever the grid is showing. What differs is only what progress
 * *means*, which is why the caller supplies the numbers and the caption rather
 * than the component guessing.
 *
 * The status badge sits at the start of the header row, which in this RTL app
 * puts it top-right — the first thing read, as a status should be.
 */
export function EntityCard({
  icon,
  title,
  subtitle,
  status,
  progress,
  meta,
  action,
  isSelected = false,
  className,
  children,
}: EntityCardProps): JSX.Element {
  return (
    <article
      className={cn(
        'flex flex-col rounded-card bg-surface p-5 shadow-card transition-colors',
        isSelected && 'bg-selected outline-[1.5px] -outline-offset-[1.5px] outline-selected-line',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-panel bg-primary-50 text-primary-700">
          <Icon name={icon} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-value font-semibold text-ink">{title}</h3>
          {subtitle !== undefined && (
            <p className="mt-0.5 truncate text-label text-ink-muted">{subtitle}</p>
          )}
        </div>

        {status !== undefined && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <ProgressBar
            value={progress.value}
            total={progress.total}
            label={progress.label}
            {...(progress.tone && { tone: progress.tone })}
          />
          {progress.caption !== undefined && (
            <p className="mt-2 text-label text-ink-muted">{progress.caption}</p>
          )}
        </div>
      )}

      {children}

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-2">
          {(meta ?? []).map((entry) => (
            <div key={entry.label} className="min-w-0">
              <dt className="text-label text-ink-subtle">{entry.label}</dt>
              <dd
                className="truncate text-value font-medium text-ink tabular-nums"
                {...(entry.ltr === true && { dir: 'ltr' })}
              >
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>

        {action !== undefined && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled === true}
            aria-label={action.label}
            title={action.label}
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-pill',
              'bg-neutral-900 text-ink-inverse shadow-pill transition-colors hover:bg-neutral-800',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Icon name={action.icon ?? 'chevron-end'} className="size-[18px]" />
          </button>
        )}
      </div>
    </article>
  );
}

/** The responsive grid these cards live in. */
export function EntityGrid({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
