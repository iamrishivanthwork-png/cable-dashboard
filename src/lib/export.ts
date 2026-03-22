export function exportToCSV (filename: string, rows: object[]) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = (row as any)[h]
        // Wrap in quotes if contains comma or newline
        if (val === null || val === undefined) return ""
        const str = String(val)
        return str.includes(",") || str.includes("\n") ? `"${str}"` : str
      }).join(",")
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
