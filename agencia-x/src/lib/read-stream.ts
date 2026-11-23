/** Lê uma resposta text/plain em streaming e chama onChunk com o texto acumulado. */
export async function readTextStream(res: Response, onText: (full: string) => void, signal?: AbortSignal) {
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Erro ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    if (signal?.aborted) { await reader.cancel(); break; }
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  return full;
}
