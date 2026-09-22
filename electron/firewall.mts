import { execFile } from "node:child_process";
import { createLogger } from "./log.mts";

export type FirewallStatus = {
  blocked: boolean;
  publicNetwork: boolean;
  allowedOnNetwork: boolean;
};

type Report = { block?: unknown; allow?: unknown; networks?: unknown };

const log = createLogger("firewall");
const CACHE_MS = 60_000;
const READ_TIMEOUT_MS = 8_000;

let cached: { at: number; value: FirewallStatus | null } | null = null;

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  return value === undefined || value === null ? [] : [String(value)];
}

export function readFirewallStatus(stdout: string): FirewallStatus | null {
  let report: Report;
  try {
    report = JSON.parse(stdout) as Report;
  } catch {
    return null;
  }

  const networks = list(report.networks);
  const block = list(report.block).join(",");
  const allow = list(report.allow).join(",");
  const covers = (rules: string, category: string) =>
    rules.includes(category) || rules.includes("Any");

  return {
    blocked: networks.some((network) => covers(block, network)),
    publicNetwork: networks.includes("Public"),
    allowedOnNetwork: networks.some((network) => covers(allow, network)),
  };
}

function powershell(): string {
  const program = process.execPath.replace(/'/g, "''");
  return [
    `$rules = Get-NetFirewallApplicationFilter -Program '${program}' -ErrorAction SilentlyContinue | Get-NetFirewallRule | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' }`,
    "$profiles = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | ForEach-Object { $_.NetworkCategory.ToString() })",
    "[pscustomobject]@{ block = @($rules | Where-Object { $_.Action -eq 'Block' } | ForEach-Object { $_.Profile.ToString() }); allow = @($rules | Where-Object { $_.Action -eq 'Allow' } | ForEach-Object { $_.Profile.ToString() }); networks = @($profiles) } | ConvertTo-Json -Compress",
  ].join("; ");
}

// Dismissing the Windows access prompt writes inbound block rules, and a network left on the
// Public profile has the same effect: the television can no longer come and fetch the video.
export function firewallStatus(): Promise<FirewallStatus | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.value);

  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", powershell()],
      { windowsHide: true, timeout: READ_TIMEOUT_MS },
      (error, stdout) => {
        if (error) log.warn("could not read the firewall rules", { err: error });
        const value = error ? null : readFirewallStatus(stdout);
        cached = { at: Date.now(), value };
        resolve(value);
      },
    );
  });
}
