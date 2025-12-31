export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  format?: (value: any, row: T) => string | number;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headers = columns.map((col) => col.header);
  const csvRows = rows.map((row) =>
    columns
      .map((col) => {
        const rawValue =
          typeof col.key === "string" && !(col.key in row)
            ? undefined
            : (row as any)[col.key as keyof T];
        const value = col.format ? col.format(rawValue, row) : rawValue;
        return escapeForCsv(value ?? "");
      })
      .join(",")
  );

  return [headers.join(","), ...csvRows].join("\n");
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.click();
  URL.revokeObjectURL(url);
}

function escapeForCsv(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

