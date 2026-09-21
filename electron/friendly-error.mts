type ErrorLike = { name?: string; code?: string; message?: string; cause?: { code?: string } };

const HTTP_PREFIX = /^HTTP (\d+)/;

// The technical detail stays in the main process log; the interface only shows this.
export function friendlyErrorMessage(error: unknown): string {
  if (!error) return "Erreur inconnue";

  const { name, code, message, cause } = error as ErrorLike;
  if (name === "AbortError") return "Téléchargement annulé";

  const reason = code ?? cause?.code;
  const text = String(message ?? error);

  if (/stall|bloqu(é|e)/i.test(text)) return "Connexion trop lente ou interrompue, réessaie";
  if (reason === "ETIMEDOUT" || /timeout|d[ée]lai d[ée]pass[ée]|timed? ?out/i.test(text)) {
    return "Le serveur ne répond pas, réessaie plus tard";
  }
  if (reason === "ECONNRESET" || /ECONNRESET|socket hang up/i.test(text)) {
    return "Connexion interrompue, réessaie";
  }
  if (reason === "ECONNREFUSED") return "Serveur injoignable";
  if (reason === "ENOTFOUND" || reason === "EAI_AGAIN") return "Hébergeur introuvable";
  if (/URL bloqu[ée]e/i.test(text)) return "Lien de téléchargement invalide";
  if (/Range non honor/i.test(text)) return "Hébergeur incompatible avec ce mode de téléchargement";
  if (reason === "ENOSPC" || /ENOSPC/i.test(text)) return "Espace disque insuffisant";
  if (reason === "EACCES" || reason === "EPERM" || /EACCES|EPERM/i.test(text)) {
    return "Accès refusé au dossier de téléchargement";
  }

  const http = HTTP_PREFIX.exec(text);
  if (http) {
    const status = Number(http[1]);
    if (status === 401 || status === 403) return "Accès refusé par l'hébergeur";
    if (status === 404) return "Fichier introuvable sur l'hébergeur";
    if (status === 429) return "Trop de requêtes, réessaie dans un instant";
    if (status >= 500) return "Hébergeur indisponible";
    return "Erreur de l'hébergeur";
  }

  return "Échec du téléchargement";
}
