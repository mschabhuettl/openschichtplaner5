/**
 * Unit tests for DataTable component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type Column } from '../components/DataTable';

interface Person {
  id: number;
  name: string;
  role: string;
}

const data: Person[] = [
  { id: 1, name: 'Anna Müller', role: 'Admin' },
  { id: 2, name: 'Bob Schmidt', role: 'User' },
  { id: 3, name: 'Clara Bauer', role: 'User' },
];

const columns: Column<Person>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Rolle' },
];

const rowKey = (row: Person) => row.id;

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable data={data} columns={columns} rowKey={rowKey} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Rolle')).toBeTruthy();
  });

  it('renders all rows', () => {
    render(<DataTable data={data} columns={columns} rowKey={rowKey} />);
    expect(screen.getByText('Anna Müller')).toBeTruthy();
    expect(screen.getByText('Bob Schmidt')).toBeTruthy();
    expect(screen.getByText('Clara Bauer')).toBeTruthy();
  });

  it('shows emptyText when data is empty', () => {
    render(<DataTable data={[]} columns={columns} rowKey={rowKey} emptyText="Keine Daten" />);
    expect(screen.getByText('Keine Daten')).toBeTruthy();
  });

  it('filters rows by search query', () => {
    render(<DataTable data={data} columns={columns} rowKey={rowKey} searchable />);
    const input = screen.getByPlaceholderText('Suchen…');
    fireEvent.change(input, { target: { value: 'anna' } });
    expect(screen.getByText('Anna Müller')).toBeTruthy();
    expect(screen.queryByText('Bob Schmidt')).toBeNull();
  });

  it('hides search input when searchable=false', () => {
    render(<DataTable data={data} columns={columns} rowKey={rowKey} searchable={false} />);
    expect(screen.queryByPlaceholderText('Suchen…')).toBeNull();
  });

  it('calls onRowClick when row clicked', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={data} columns={columns} rowKey={rowKey} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Anna Müller'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('sorts rows ascending on column header click', () => {
    render(<DataTable data={data} columns={columns} rowKey={rowKey} />);
    fireEvent.click(screen.getByText('Name'));
    const cells = screen.getAllByRole('cell').filter(c => ['Anna Müller', 'Bob Schmidt', 'Clara Bauer'].includes(c.textContent ?? ''));
    expect(cells[0].textContent).toBe('Anna Müller');
    expect(cells[1].textContent).toBe('Bob Schmidt');
  });

  it('sorts rows descending on second column header click', () => {
    render(<DataTable data={data} columns={columns} rowKey={rowKey} />);
    fireEvent.click(screen.getByText('Name')); // asc
    fireEvent.click(screen.getByText('Name')); // desc
    const cells = screen.getAllByRole('cell').filter(c => ['Anna Müller', 'Bob Schmidt', 'Clara Bauer'].includes(c.textContent ?? ''));
    expect(cells[0].textContent).toBe('Clara Bauer');
  });

  it('shows custom render output', () => {
    const cols: Column<Person>[] = [
      { key: 'name', label: 'Name', render: (row) => <strong>{row.name.toUpperCase()}</strong> },
    ];
    render(<DataTable data={[data[0]]} columns={cols} rowKey={rowKey} />);
    expect(screen.getByText('ANNA MÜLLER')).toBeTruthy();
  });
});
