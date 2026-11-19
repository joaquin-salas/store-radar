/** Server-side pagination shared by the table queries. */
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginate<T>(rows: T[], page: number, pageSize: number): Page<T> {
  return { rows: rows.slice(page * pageSize, (page + 1) * pageSize), total: rows.length, page, pageSize };
}
