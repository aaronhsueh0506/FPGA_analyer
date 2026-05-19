import client from './client'

export interface BatchSummaryAPI {
  id: number
  name: string | null
  register_name: string
  dat_count: number | null
  warning_count: number
  analyzed_at: string
}

export interface BitFieldDefAPI {
  name: string
  width: number
  register_name: string
  register_addr: string
}

export interface BatchDetailAPI {
  summary: BatchSummaryAPI
  bitFields: BitFieldDefAPI[]
  rows: Array<{ testCase: string; values: Array<number | null> }>
  warnings: string[]
}

export async function listBatches(): Promise<BatchSummaryAPI[]> {
  const { data } = await client.get<BatchSummaryAPI[]>('/api/batches')
  return data
}

export async function createBatch(
  registerId: number,
  files: File[],
  onProgress?: (pct: number) => void
): Promise<BatchSummaryAPI> {
  const form = new FormData()
  form.append('register_id', String(registerId))
  files.forEach((f) => {
    const rel = (f as any).webkitRelativePath as string | undefined
    if (rel) {
      // Preserve folder/filename so backend stores "folder/file.dat" as the TestCase name
      form.append('files', new File([f], rel, { type: f.type }))
    } else {
      form.append('files', f)
    }
  })

  const { data } = await client.post<BatchSummaryAPI>('/api/batches', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

export async function getBatch(id: number): Promise<BatchDetailAPI> {
  const { data } = await client.get<BatchDetailAPI>(`/api/batches/${id}`)
  return data
}

export async function deleteBatch(id: number): Promise<void> {
  await client.delete(`/api/batches/${id}`)
}

export function downloadCsvUrl(id: number): string {
  return `http://localhost:8000/api/batches/${id}/download.csv`
}

export function downloadXlsxUrl(id: number): string {
  return `http://localhost:8000/api/batches/${id}/download.xlsx`
}
