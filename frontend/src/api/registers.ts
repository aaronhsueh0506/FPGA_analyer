import client from './client'

export interface RegisterDefinition {
  id: number
  name: string
  original_filename: string | null
  register_count: number | null
  bitfield_count: number | null
  uploaded_at: string
}

export async function listRegisters(): Promise<RegisterDefinition[]> {
  const { data } = await client.get<RegisterDefinition[]>('/api/registers')
  return data
}

export async function uploadRegister(file: File, name?: string): Promise<RegisterDefinition> {
  const form = new FormData()
  form.append('file', file)
  if (name && name.trim()) form.append('name', name.trim())
  const { data } = await client.post<RegisterDefinition>('/api/registers', form)
  return data
}

export async function renameRegister(id: number, name: string): Promise<RegisterDefinition> {
  const { data } = await client.patch<RegisterDefinition>(`/api/registers/${id}`, { name })
  return data
}

export async function deleteRegister(id: number): Promise<void> {
  await client.delete(`/api/registers/${id}`)
}
