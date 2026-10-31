import { clsx } from 'clsx'

export const Table = ({ children, className }) => (
  <div className="overflow-x-auto">
    <table className={clsx('w-full', className)}>{children}</table>
  </div>
)

const align = (a) => (a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left')

const TableHeader = ({ children, className }) => <thead className={clsx('bg-raised', className)}>{children}</thead>
const TableBody = ({ children, className }) => <tbody className={clsx('divide-y divide-line', className)}>{children}</tbody>
const TableRow = ({ children, className, onClick, hoverable = true }) => (
  <tr className={clsx(hoverable && 'transition-colors hover:bg-raised/70', onClick && 'cursor-pointer', className)} onClick={onClick}>
    {children}
  </tr>
)
const TableHead = ({ children, className, align: a = 'left' }) => (
  <th className={clsx('px-4 py-3 text-xs font-bold text-ink-soft', align(a), className)}>{children}</th>
)
const TableCell = ({ children, className, align: a = 'left' }) => (
  <td className={clsx('px-4 py-3.5 text-sm text-ink', align(a), className)}>{children}</td>
)

Table.Header = TableHeader
Table.Body = TableBody
Table.Row = TableRow
Table.Head = TableHead
Table.Cell = TableCell
