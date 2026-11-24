import type { TableData } from '../../lib/assistantTypes';

interface ResponseTableProps {
  table: TableData;
}

export function ResponseTable({ table }: ResponseTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50">
          <tr>
            {table.headers.map((header, index) => (
              <th
                key={index}
                className="px-3 py-2 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-neutral-200">
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                  {typeof cell === 'number' ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
