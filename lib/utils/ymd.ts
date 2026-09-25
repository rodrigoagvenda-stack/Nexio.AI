/** Data local no formato AAAA-MM-DD (toISOString usa UTC e muda o dia à noite no Brasil). */
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
