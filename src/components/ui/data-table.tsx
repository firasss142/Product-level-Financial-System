"use client";
/* eslint-disable react-hooks/incompatible-library -- @tanstack/react-table v8 uses its own internal hook model incompatible with the react-hooks exhaustive-deps rule */

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { SkeletonTable } from "./skeleton";
import { EmptyState } from "./empty-state";

// Augment TanStack's ColumnMeta so consumers never need to cast
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    numeric?: boolean;
    width?: string;
  }
}

// Hoisted once — row model factories are stable references across all renders
const coreRowModel = getCoreRowModel();
const sortedRowModel = getSortedRowModel();
const filteredRowModel = getFilteredRowModel();
const paginationRowModel = getPaginationRowModel();

interface DataTableColumn<T> {
  id: string;
  header: string;
  accessorKey?: keyof T & string;
  accessorFn?: (row: T) => unknown;
  cell?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  numeric?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  pageSize?: 10 | 25 | 50;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={cn(
        "inline-block ml-1",
        direction ? "text-navy" : "text-warm-gray-300"
      )}
      aria-hidden="true"
    >
      <path
        d="M7 3l3 4H4l3-4z"
        fill={direction === "asc" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M7 11l3-4H4l3 4z"
        fill={direction === "desc" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function DataTable<T>({
  data,
  columns,
  pageSize: initialPageSize = 10,
  searchable = false,
  searchPlaceholder = "Rechercher\u2026",
  emptyMessage = "Aucune donn\u00e9e",
  loading = false,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const tanstackColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        accessorKey: col.accessorKey,
        accessorFn: col.accessorFn,
        header: col.header,
        cell: col.cell
          ? (info) => col.cell!(info.getValue(), info.row.original)
          : undefined,
        enableSorting: col.sortable !== false,
        meta: { numeric: col.numeric, width: col.width },
      })),
    [columns]
  );

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: {
      pagination: { pageSize: initialPageSize },
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const currentPageSize = table.getState().pagination.pageSize;

  if (loading) {
    return (
      <div className={cn("bg-white shadow-sm rounded-xl p-6", className)}>
        <SkeletonTable rows={initialPageSize > 10 ? 10 : initialPageSize} cols={columns.length} />
      </div>
    );
  }

  return (
    <div className={cn("bg-white shadow-sm rounded-xl", className)}>
      {searchable && (
        <div className="p-4 pb-0">
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-gray-400"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-warm-gray-200 text-sm text-navy bg-white placeholder:text-warm-gray-400 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-warm-gray-200">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const canSort = header.column.getCanSort();

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-medium text-warm-gray-500",
                        meta?.numeric && "text-right",
                        meta?.width,
                        canSort && "cursor-pointer select-none"
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      <span className="inline-flex items-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIcon direction={header.column.getIsSorted()} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyMessage} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-warm-gray-100 hover:bg-warm-gray-50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-4 py-3 text-navy",
                          meta?.numeric && "text-right tabular-nums",
                          meta?.width
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="px-4 py-3 flex items-center justify-between border-t border-warm-gray-100 text-sm">
          <div className="flex items-center gap-2 text-warm-gray-500">
            <span>
              Page {pageIndex + 1} sur {pageCount}
            </span>
            <span className="text-warm-gray-300" aria-hidden="true">|</span>
            <div className="flex items-center gap-1" role="group" aria-label="Lignes par page">
              {([10, 25, 50] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => table.setPageSize(size)}
                  aria-pressed={currentPageSize === size}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-xs transition-colors cursor-pointer",
                    currentPageSize === size
                      ? "bg-navy text-white"
                      : "text-warm-gray-500 hover:bg-warm-gray-100"
                  )}
                >
                  {size}
                </button>
              ))}
              <span className="text-warm-gray-400 ml-1" aria-hidden="true">par page</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Page pr\u00e9c\u00e9dente"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Page suivante"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
export type { DataTableProps, DataTableColumn };
