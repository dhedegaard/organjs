/** `m:ss.t` for transport displays. */
export function formatSeconds(seconds: number): string {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  const tenths = Math.floor((seconds - whole) * 10)
  return `${minutes}:${String(rest).padStart(2, '0')}.${tenths}`
}
