// Type definitions for baffle
declare module 'baffle' {
  interface BaffleOptions {
    characters?: string
    speed?: number
  }

  interface BaffleInstance {
    start(): BaffleInstance
    reveal(duration: number): BaffleInstance
    stop(): void
  }

  function baffle(element: HTMLElement, options?: BaffleOptions): BaffleInstance
  function baffle(elements: NodeListOf<HTMLElement>, options?: BaffleOptions): BaffleInstance[]

  export default baffle
}
