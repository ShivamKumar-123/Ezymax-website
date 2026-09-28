/** Minimal CIDR helpers for the IP whitelist editor (IPv4 full, IPv6 syntax only). */

const V4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

export function validateCidr(input: string): string | null {
  const v = input.trim();
  if (!v) return "Enter an IP address or CIDR range";
  const [ip, bits, ...rest] = v.split("/");
  if (rest.length) return "Only one “/” is allowed";
  if (ip!.includes(":")) {
    if (!/^[0-9a-fA-F:]+$/.test(ip!) || (ip!.match(/::/g)?.length ?? 0) > 1) return "Invalid IPv6 address";
    if (bits !== undefined && (!/^\d+$/.test(bits) || +bits < 16 || +bits > 128)) return "IPv6 prefix must be /16 – /128";
    return null;
  }
  if (!V4.test(ip!)) return "Invalid IPv4 address — e.g. 185.44.76.0/24";
  if (bits !== undefined) {
    if (!/^\d+$/.test(bits)) return "Prefix must be a number";
    const b = +bits;
    if (b < 8 || b > 32) return "Prefix must be between /8 and /32";
    const mask = b === 0 ? 0 : (~0 << (32 - b)) >>> 0;
    if ((ipv4ToInt(ip!) & mask) >>> 0 !== ipv4ToInt(ip!)) return `Host bits set — did you mean ${networkOf(ip!, b)}/${b}?`;
  }
  return null;
}

function networkOf(ip: string, b: number) {
  const mask = (~0 << (32 - b)) >>> 0;
  const n = (ipv4ToInt(ip) & mask) >>> 0;
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
}

export function cidrSize(cidr: string) {
  const [ip, bits] = cidr.split("/");
  if (ip!.includes(":")) return `/${bits ?? 128} IPv6`;
  const b = bits === undefined ? 32 : +bits;
  const n = 2 ** (32 - b);
  return n === 1 ? "single host" : `${n.toLocaleString("en-US")} addresses`;
}

export function cidrContains(cidr: string, ip: string) {
  const [net, bits] = cidr.split("/");
  if (net!.includes(":") || ip.includes(":") || !V4.test(ip)) return false;
  const b = bits === undefined ? 32 : +bits;
  const mask = b === 0 ? 0 : (~0 << (32 - b)) >>> 0;
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(net!) & mask) >>> 0);
}

export function isValidIp(ip: string) {
  return V4.test(ip.trim());
}
