declare module 'localtunnel' {
  interface Options {
    port: number
    host?: string
    subdomain?: string
    local_host?: string
  }
  interface Tunnel {
    url: string
    on(event: 'close' | 'error', cb: (err?: Error) => void): void
    close(): void
  }
  const localtunnel: (opts: Options) => Promise<Tunnel>
  export default localtunnel
}
