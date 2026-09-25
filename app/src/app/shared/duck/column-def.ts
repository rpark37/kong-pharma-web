/** One grid column: which table column, how wide, how to show a cell. */
export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  format?: (v: unknown) => string;
  sortable?: boolean;
}
