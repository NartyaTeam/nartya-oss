import type { CastStage } from "./cast-session.mts";
import type { FirewallStatus } from "./firewall.mts";

export type CastFailure = { error: string; mediaFailed?: boolean };

// mediaFailed means the television did fetch the video and could not play it, so another
// source has a chance; anything else is about reaching this machine at all.
export function explainCastFailure(
  stage: CastStage,
  reached: boolean,
  firewall: FirewallStatus | null,
): CastFailure {
  if (stage === "connect") {
    return {
      error: "L'appareil ne répond pas. Vérifie qu'il est allumé et sur le même réseau que ce PC.",
    };
  }
  if (stage === "launch") {
    return { error: "L'appareil a refusé de lancer la lecture. Réessaie dans quelques secondes." };
  }
  if (reached) {
    return {
      error: "La TV n'a pas pu lire cette vidéo. Essaie une autre source.",
      mediaFailed: true,
    };
  }
  if (firewall?.blocked || (firewall?.publicNetwork && !firewall.allowedOnNetwork)) {
    return {
      error:
        "Le pare-feu Windows empêche la TV de récupérer la vidéo sur ce PC. Autorise Nartya dans " +
        "« Pare-feu Windows Defender › Autoriser une application », ou passe ce réseau en « Privé ».",
    };
  }
  return {
    error:
      "La TV n'arrive pas à récupérer la vidéo sur ce PC. Vérifie ton pare-feu, et coupe ton VPN s'il est actif.",
  };
}
