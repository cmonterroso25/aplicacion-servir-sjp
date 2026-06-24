import * as XLSX from 'xlsx'

export function exportToExcel(data: Record<string, any>[], filename: string, sheetName = 'Reporte') {
  if (!data.length) return

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const colWidths = Object.keys(data[0]).map((key) => ({
    wch: Math.max(key.length, ...data.map((row) => String(row[key] ?? '').length)) + 2,
  }))
  worksheet['!cols'] = colWidths

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
