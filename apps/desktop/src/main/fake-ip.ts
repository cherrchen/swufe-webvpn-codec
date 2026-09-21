/** Detection of fake-ip DNS answers (`198.18.0.0/15`, RFC 2544 benchmarking range).
 *
 * Clash / mihomo / sing-box in TUN mode hand out addresses from that range
 * instead of real ones; a bridge upstream resolved to such an address never
 * reaches the gateway and the connection just hangs (`KI-013`). The start path
 * uses this predicate to refuse such an environment up front.
 */

/** True when `address` is a dotted-quad IPv4 address inside `198.18.0.0/15`. */
export function isFakeIpAddress(address: string): boolean {
  const octets = address.split('.')
  if (octets.length !== 4) return false
  const numbers = octets.map((octet) => (/^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN))
  if (numbers.some((value) => !Number.isInteger(value) || value > 255)) return false
  return numbers[0] === 198 && (numbers[1] === 18 || numbers[1] === 19)
}
