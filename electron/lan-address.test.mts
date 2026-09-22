import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPrivateIpv4,
  isVirtualNetworkAddress,
  localAddressFor,
  sharesSubnet,
  type Interface,
} from "./lan-address.mts";

const card = (name: string, address: string, netmask = "255.255.255.0"): Interface => ({
  name,
  address,
  netmask,
  virtual: /^(docker|vEthernet|utun|wsl)/i.test(name),
});

const wifi = card("en0", "192.168.1.20");
const docker = card("docker0", "172.17.0.1", "255.255.0.0");
const vpn = card("utun3", "10.8.0.2", "255.255.255.0");

test("matches an address against a subnet", () => {
  assert.equal(sharesSubnet("192.168.1.50", wifi), true);
  assert.equal(sharesSubnet("192.168.2.50", wifi), false);
  assert.equal(sharesSubnet("172.17.9.9", docker), true);
  assert.equal(sharesSubnet("not an ip", wifi), false);
});

test("answers the card that shares the device subnet, not the first one", () => {
  // The vpn comes first on purpose: taking it would hand the television an address it
  // cannot reach.
  assert.equal(localAddressFor("192.168.1.77", [vpn, docker, wifi]), "192.168.1.20");
});

test("prefers a real card when the device address says nothing", () => {
  assert.equal(localAddressFor("", [docker, wifi]), "192.168.1.20");
  assert.equal(localAddressFor("not an ip", [docker, wifi]), "192.168.1.20");
});

test("falls back to loopback rather than nothing", () => {
  assert.equal(localAddressFor("192.168.1.77", []), "127.0.0.1");
});

test("recognises an address that belongs to a virtual adapter", () => {
  assert.equal(isVirtualNetworkAddress("172.17.0.9", [wifi, docker]), true);
  assert.equal(isVirtualNetworkAddress("192.168.1.9", [wifi, docker]), false);
  assert.equal(isVirtualNetworkAddress("8.8.8.8", [wifi, docker]), false);
});

test("knows the private ranges", () => {
  for (const ip of ["10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.0.1"]) {
    assert.equal(isPrivateIpv4(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "193.168.0.1", "nope"]) {
    assert.equal(isPrivateIpv4(ip), false, ip);
  }
});
