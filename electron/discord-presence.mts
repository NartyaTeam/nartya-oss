import type { Presence } from "../shared/presence.ts";

// Discord refuses the whole activity when one field goes over its limits.
const TEXT_MAX = 128;
const LABEL_MAX = 32;
const URL_MAX = 512;
const BUTTONS_MAX = 2;

// Uploaded under this name in the Discord application's rich presence assets.
const LOGO_ASSET = "nartya_logo";

export type Activity = {
  details: string;
  state: string;
  timestamps: { start: number };
  assets: { large_image: string; large_text: string };
  buttons?: { label: string; url: string }[];
  instance: false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function readButton(value: unknown): Presence["buttons"][number] | null {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.url !== "string") {
    return null;
  }
  if (!value.url.startsWith("https://") || value.url.length > URL_MAX) return null;
  return { label: value.label.slice(0, LABEL_MAX), url: value.url };
}

export function readPresence(value: unknown): Presence | null {
  if (!isRecord(value) || !Array.isArray(value.buttons)) return null;
  const { details, state, largeText } = value;
  if (typeof details !== "string" || typeof state !== "string" || typeof largeText !== "string") {
    return null;
  }
  const buttons = value.buttons
    .map(readButton)
    .filter((button) => button !== null)
    .slice(0, BUTTONS_MAX);
  return {
    details: details.slice(0, TEXT_MAX),
    state: state.slice(0, TEXT_MAX),
    largeText: largeText.slice(0, TEXT_MAX),
    buttons,
  };
}

export function toActivity(presence: Presence, startedAt: number): Activity {
  return {
    details: presence.details,
    state: presence.state,
    timestamps: { start: startedAt },
    assets: { large_image: LOGO_ASSET, large_text: presence.largeText },
    ...(presence.buttons.length > 0 && { buttons: presence.buttons }),
    instance: false,
  };
}
