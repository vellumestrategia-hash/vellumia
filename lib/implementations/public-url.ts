import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { DnsResolver, ResolvedAddress } from "./contracts";

const IPV4_SPECIAL: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 8],
  [0x0a000000, 8],
  [0x64400000, 10],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0000000, 24],
  [0xc0000200, 24],
  [0xc0586300, 24],
  [0xc0a80000, 16],
  [0xc6120000, 15],
  [0xc6336400, 24],
  [0xcb007100, 24],
  [0xe0000000, 4],
  [0xf0000000, 4],
];
function ipv6Number(ip: string): bigint {
  const halves = ip.split("::");
  const left = (halves[0] ?? "").split(":").filter(Boolean);
  const right = (halves[1] ?? "").split(":").filter(Boolean);
  const words =
    halves.length === 1
      ? left
      : [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return words.reduce((number, word) => (number << 16n) | BigInt(`0x${word}`), 0n);
}
function inV6Range(ip: bigint, base: bigint, prefix: number): boolean {
  const shift = BigInt(128 - prefix);
  return ip >> shift === base >> shift;
}
/** IPv6 deve ser unicast global. Túneis, mapped, NAT64 e faixas especiais falham fechado. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
    return !IPV4_SPECIAL.some(([base, prefix]) => {
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      return (value & mask) >>> 0 === (base & mask) >>> 0;
    });
  }
  if (family !== 6 || address.includes(".")) return false;
  const value = ipv6Number(address);
  return (
    inV6Range(value, 0x20000000000000000000000000000000n, 3) &&
    !inV6Range(value, 0x20010000000000000000000000000000n, 23) &&
    !inV6Range(value, 0x20010db8000000000000000000000000n, 32) &&
    !inV6Range(value, 0x20020000000000000000000000000000n, 16) &&
    !inV6Range(value, 0x3fff0000000000000000000000000000n, 20)
  );
}
export function parsePublicUrl(input: string): URL {
  if (typeof input !== "string" || input.length > 2048) throw new Error("unsafe_url:invalid");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("unsafe_url:invalid");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsafe_url:protocol");
  if (url.username || url.password) throw new Error("unsafe_url:userinfo");
  if (url.port) throw new Error("unsafe_url:port"); // WHATWG remove somente a porta padrão do protocolo.
  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!hostname || hostname === "localhost" || /\.(localhost|local|internal)$/.test(hostname))
    throw new Error("unsafe_url:hostname");
  if (isIP(hostname) && !isPublicAddress(hostname)) throw new Error("unsafe_url:private_ip");
  url.hash = "";
  return url;
}
export const resolvePublicDns: DnsResolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};
export async function resolvePublicAddress(
  url: URL,
  resolver: DnsResolver = resolvePublicDns,
): Promise<ResolvedAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  let addresses: readonly ResolvedAddress[];
  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await resolver(hostname);
  } catch {
    throw new Error("unsafe_url:dns_failed");
  }
  if (!addresses.length) throw new Error("unsafe_url:dns_empty");
  for (const address of addresses)
    if (isIP(address.address) !== address.family || !isPublicAddress(address.address))
      throw new Error("unsafe_url:private_ip");
  return addresses[0]!;
}
