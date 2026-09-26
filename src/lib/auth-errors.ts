const MESSAGES: [RegExp, string][] = [
  [/pwned/, "Ce mot de passe apparaît dans des fuites de données connues. Choisis-en un autre."],
  [/captcha/, "Vérification anti-robot échouée. Réessaie."],
  [/invalid login credentials/, "Email ou mot de passe incorrect."],
  [
    /already registered|already exists|already been registered/,
    "Un compte existe déjà avec cet email.",
  ],
  [/email not confirmed/, "Confirme d'abord ton email (lien reçu par mail)."],
  [/same as the old|should be different/, "Ce mot de passe est déjà celui du compte."],
  [
    /weak password|at least 6|password should be at least/,
    "Mot de passe trop court (6 caractères minimum).",
  ],
  [/expired|invalid.*token|token.*invalid/, "Ce lien a expiré. Demande-en un nouveau."],
  [/rate limit|too many/, "Trop de tentatives. Réessaie dans un instant."],
  [/browser did not open/, "Le navigateur n'a pas pu s'ouvrir. Réessaie."],
  [/network|fetch|failed to send/, "Pas de connexion. Vérifie ton réseau."],
];

export function translateAuthError(message: string | null | undefined): string {
  const text = (message ?? "").toLowerCase();
  for (const [pattern, translation] of MESSAGES) {
    if (pattern.test(text)) return translation;
  }
  return "Une erreur est survenue. Réessaie.";
}
