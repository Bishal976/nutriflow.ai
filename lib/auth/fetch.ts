export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login?reason=session_expired'
  }
  return res
}
