/** 简易 LRU：超出容量时淘汰最久未访问项，控制内存上限 */

export class LruCache<K, V> {
  private readonly map = new Map<K, V>()

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) throw new Error('LruCache maxSize must be >= 1')
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // 刷新访问顺序
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, value)
  }

  delete(key: K): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}
