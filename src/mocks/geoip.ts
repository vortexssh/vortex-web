/** Offline GeoIP stub for MSW — maps a few public IPs to country codes. */
export function mockCountryFromIp(ip: string | null | undefined): string | null {
  if (!ip?.trim()) return null
  const value = ip.trim()
  if (
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    value.startsWith('172.') ||
    value === '127.0.0.1'
  ) {
    return null
  }
  if (value.startsWith('8.8.') || value.startsWith('1.1.1.')) return 'US'
  if (value.startsWith('77.') || value.startsWith('178.')) return 'RU'
  if (value.startsWith('5.') || value.startsWith('185.')) return 'DE'
  return 'NL'
}
