import type { ReactNode } from 'react';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  emptyMessage: string;
};

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  emptyMessage,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="empty-state body-copy">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td
                  data-label={column.header}
                  key={column.key}
                  style={{ textAlign: column.align ?? 'left' }}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
