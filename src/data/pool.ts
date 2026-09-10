export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0

  async function worker() {
    while (true) {
      const idx = i
      i++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx])
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () =>
    worker(),
  )
  await Promise.all(workers)
  return results
}
