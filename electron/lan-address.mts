import { networkInterfaces } from "node:os";

export type Interface = {
  name: string;
  address: string;
  netmask: string;
  virtual: boolean;
};

export type Interfaces = () => Interface[];

const VIRTUAL_ADAPTER =
  /^(vEthernet|docker|br-|veth|VMware|VirtualBox|utun|tun|tap|wsl|zerotier|tailscale|nordlynx|radmin|hamachi)/i;

const IPV4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;

function toNumber(ip: string): number {
  return ip.split(".").reduce((total, part) => (total << 8) + Number(part), 0) >>> 0;
}

export function lanInterfaces(): Interface[] {
  const found: Interface[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (address.address.startsWith("169.254.")) continue;
      found.push({
        name,
        address: address.address,
        netmask: address.netmask,
        virtual: VIRTUAL_ADAPTER.test(name),
      });
    }
  }
  return found;
}

export function sharesSubnet(ip: string, card: Interface): boolean {
  if (!IPV4.test(ip) || !IPV4.test(card.address) || !IPV4.test(card.netmask)) return false;
  const mask = toNumber(card.netmask);
  return (toNumber(ip) & mask) === (toNumber(card.address) & mask);
}

// The address a device can reach us on is the one on its own subnet. Taking the first
// card handed a vpn or a virtual adapter, unreachable from the television.
export function localAddressFor(remoteIp: string, cards: Interface[] = lanInterfaces()): string {
  if (IPV4.test(remoteIp)) {
    const shared = cards.find((card) => sharesSubnet(remoteIp, card));
    if (shared) return shared.address;
  }
  return (cards.find((card) => !card.virtual) ?? cards[0])?.address ?? "127.0.0.1";
}

export function isVirtualNetworkAddress(ip: string, cards: Interface[] = lanInterfaces()): boolean {
  return cards.find((card) => sharesSubnet(ip, card))?.virtual === true;
}

export function isPrivateIpv4(ip: string): boolean {
  const match = IPV4.exec(ip);
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return first === 192 && second === 168;
}
