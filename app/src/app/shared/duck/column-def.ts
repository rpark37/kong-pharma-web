/** One grid column: which table column, how wide, how to show a cell. */
export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  format?: (v: unknown) => string;
  sortable?: boolean;
  /** Identifiers (codes, symbols): rendered with translate="no" so auto-translation leaves them alone. */
  code?: boolean;
}
