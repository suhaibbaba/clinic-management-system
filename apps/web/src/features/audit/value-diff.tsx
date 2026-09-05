import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

export interface ValueDiffProps {
  oldValue: unknown;
  newValue: unknown;
}

type Row = { key: string; before: string | null; after: string | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function present(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value);
}

/**
 * Field-by-field diff of an audit entry.
 *
 * Only the fields that actually changed are listed — a raw JSON dump of both
 * sides is unreadable for the common case of a one-field edit. Creates and
 * deletes have one side missing, so every field is shown.
 */
/**
 * Stored values are technical: UUIDs, JSON, emails, times. They are Latin-script
 * and left-to-right, so they are rendered in their own `dir="ltr"` box —
 * inside an RTL cell the bidi algorithm otherwise reorders their punctuation
 * and they read as nonsense.
 */
function Value({
  tone,
  children,
}: {
  tone: 'before' | 'after';
  children: string | null;
}): JSX.Element {
  if (children === null) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <span
      dir="ltr"
      className={[
        'inline-block max-w-[20rem] overflow-x-auto whitespace-pre-wrap break-all rounded',
        'px-1.5 py-0.5 text-left font-mono text-xs',
        tone === 'before' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800',
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export function ValueDiff({ oldValue, newValue }: ValueDiffProps): JSX.Element {
  const { t } = useTranslation();

  const before = asRecord(oldValue);
  const after = asRecord(newValue);
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();

  const rows: Row[] = keys
    .map((key) => ({ key, before: present(before?.[key]), after: present(after?.[key]) }))
    .filter((row) => row.before !== row.after);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{t('audit.noChanges')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-gray-600">
              {t('audit.changes')}
            </th>
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-gray-600">
              {t('audit.oldValue')}
            </th>
            <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-gray-600">
              {t('audit.newValue')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="px-3 py-2 text-start font-medium text-gray-700">{row.key}</td>
              <td className="px-3 py-2 text-start">
                <Value tone="before">{row.before}</Value>
              </td>
              <td className="px-3 py-2 text-start">
                <Value tone="after">{row.after}</Value>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
