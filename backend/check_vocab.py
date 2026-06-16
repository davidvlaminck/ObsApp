import openpyxl

wb = openpyxl.load_workbook('../AnalysisDev/Onderwijsdoelen (3).xlsx', read_only=True)
ws = wb['Versie 2.0']

print("=== Vocabulary column samples ===")
for i, row in enumerate(ws.iter_rows(min_row=2, max_row=30, values_only=True), 2):
    if row[12]:  # Woordenschat column
        val = str(row[12])
        print(f"Row {i}: {repr(val[:100])}")
wb.close()
