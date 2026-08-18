const UNITS = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s']

export function formatUploadSpeed(bytesPerSecond) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s'

  let value = bytesPerSecond
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return unit === 0 ? `${Math.round(value)} ${UNITS[unit]}` : `${value.toFixed(1)} ${UNITS[unit]}`
}
