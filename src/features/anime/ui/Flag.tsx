import { flagHtml, type FlagCode } from "../flags.ts";

// The drawing is shared with the player's menus, which only take html.
export function Flag({ code }: { code: FlagCode }) {
  return (
    <span className="inline-flex shrink-0" dangerouslySetInnerHTML={{ __html: flagHtml(code) }} />
  );
}
