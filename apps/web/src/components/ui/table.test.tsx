import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Table, type Column } from '@web/components/ui/table';
// Initialises the shared i18next instance, so `t()` returns Arabic rather
// than echoing the key — the labels are the thing under test here.
import '@web/i18n';
import ar from '@web/i18n/locales/ar.json';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly balance: string;
}

const ROWS: readonly Row[] = [
  { id: '1', name: 'أحمد خالد', phone: '0931000001', address: 'المزة، دمشق', balance: '120.00' },
  { id: '2', name: 'ليلى محمود', phone: '0931000002', address: 'برزة، دمشق', balance: '0.00' },
];

const COLUMNS: readonly Column<Row>[] = [
  { key: 'name', header: 'patients.fullName', primary: true, render: (row) => row.name },
  { key: 'phone', header: 'patients.phone', render: (row) => row.phone },
  { key: 'address', header: 'patients.address', hideOnMobile: true, render: (row) => row.address },
  { key: 'balance', header: 'patients.balance', align: 'numeric', render: (row) => row.balance },
  {
    key: 'actions',
    header: 'common.actions',
    actions: true,
    render: () => <button type="button">فتح الملف</button>,
  },
];

/**
 * jsdom has no layout, so `matchMedia` is stubbed to answer the breakpoint
 * question directly. Unstubbed it is absent entirely, which the hook reads as
 * "not mobile" — so every existing screen test keeps getting the table.
 */
function setViewport(isMobile: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isMobile && query.includes('max-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('Table', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a real table above the breakpoint', () => {
    setViewport(false);
    render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />);

    const table = screen.getByRole('table');

    expect(within(table).getByRole('columnheader', { name: ar.patients.address })).toBeVisible();
    expect(within(table).getAllByRole('row')).toHaveLength(ROWS.length + 1);
  });

  it('renders one label/value card per row below the breakpoint', () => {
    setViewport(true);
    const { container } = render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />);

    // No table at all below the breakpoint — one shape, never two hidden ones.
    expect(screen.queryByRole('table')).toBeNull();

    // Each card pairs a column's own header with that row's value, which is
    // the point of driving both shapes from one `columns` array.
    const lists = container.querySelectorAll('dl');
    expect(lists).toHaveLength(ROWS.length);

    const first = lists[0] as HTMLElement;
    expect(within(first).getByText(ar.patients.phone)).toBeInTheDocument();
    expect(within(first).getByText('0931000001')).toBeInTheDocument();
    expect(within(first).getByText(ar.patients.balance)).toBeInTheDocument();
  });

  it('leaves hideOnMobile columns out of the cards but keeps them in the table', () => {
    setViewport(true);
    const mobile = render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />);

    expect(mobile.queryByText(ar.patients.address)).toBeNull();
    expect(mobile.queryByText('المزة، دمشق')).toBeNull();
    mobile.unmount();

    // Still on the wide shape, where there is room for it.
    setViewport(false);
    render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />);
    expect(within(screen.getByRole('table')).getByText('المزة، دمشق')).toBeInTheDocument();
  });

  it('gives the primary column no label and the actions no label/value row', () => {
    setViewport(true);
    render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />);

    // The name is the card's title, not a captioned row.
    expect(screen.getByText('أحمد خالد').tagName).toBe('P');
    expect(screen.queryByText(ar.common.actions)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'فتح الملف' })).toHaveLength(ROWS.length);
  });

  it('makes the whole card activate when rows are clickable', () => {
    setViewport(true);
    const opened: string[] = [];
    render(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        onRowClick={(row) => opened.push(row.id)}
        rowLabel={(row) => row.name}
      />,
    );

    screen.getByRole('button', { name: 'ليلى محمود' }).click();

    expect(opened).toEqual(['2']);
  });

  it('shows a card-shaped skeleton while loading', () => {
    setViewport(true);
    const { container } = render(
      <Table columns={COLUMNS} rows={[]} rowKey={(row) => row.id} isLoading />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(ar.common.loading);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the empty state instead of either shape', () => {
    setViewport(true);
    render(
      <Table columns={COLUMNS} rows={[]} rowKey={(row) => row.id} empty={<p>لا توجد نتائج</p>} />,
    );

    expect(screen.getByText('لا توجد نتائج')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
