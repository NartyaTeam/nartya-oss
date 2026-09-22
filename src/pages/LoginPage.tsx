import { useState } from "react";
import { translateAuthError } from "../lib/auth-errors.ts";
import { CANCELLED, type AuthFlows } from "../features/auth/flows.ts";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Notice } from "../ui/Notice.tsx";

type Mode = "signin" | "signup" | "forgot";
type Busy = "email" | "discord" | null;

const TITLES: Record<Mode, string> = {
  signin: "Se connecter",
  signup: "Créer un compte",
  forgot: "Mot de passe oublié",
};

type LoginProps = { flows: AuthFlows; onRecovery: () => void };

export function LoginPage({ flows, onRecovery }: LoginProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchTo(next: Mode): void {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");

    if (mode !== "forgot" && password.length < 6) {
      setError("Renseigne un email et un mot de passe d'au moins 6 caractères.");
      return;
    }

    setBusy("email");
    try {
      if (mode === "forgot") await forgot();
      else await withPassword();
    } finally {
      setBusy(null);
    }
  }

  async function withPassword(): Promise<void> {
    const result =
      mode === "signup"
        ? await flows.signUp(email, password, displayName)
        : await flows.signIn(email, password);

    if (result.error) setError(translateAuthError(result.error));
    else if (result.needsConfirm) {
      setMode("signin");
      setNotice("Compte créé. Confirme ton email, puis connecte-toi.");
    }
  }

  async function forgot(): Promise<void> {
    const result = await flows.requestPasswordReset(email);
    if (result.error && !result.sent) {
      setError(translateAuthError(result.error));
      return;
    }
    if (result.recovered) {
      onRecovery();
      return;
    }
    // The link comes back to this app, so it has to stay open on this screen.
    setNotice(
      result.error === CANCELLED
        ? "Lien envoyé. Ouvre-le depuis cet ordinateur, l'application t'attend ici."
        : "Lien envoyé. Ouvre-le pour choisir un nouveau mot de passe.",
    );
  }

  async function discord(): Promise<void> {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy("discord");
    try {
      const result = await flows.signInWithDiscord();
      if (result.error === CANCELLED) setNotice("Connexion annulée.");
      else if (result.error) setError(translateAuthError(result.error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Nartya</h1>
          <p className="mt-1 text-sm text-neutral-400">{TITLES[mode]}</p>
        </div>

        <Button variant="ghost" onClick={() => void discord()} disabled={busy !== null}>
          {busy === "discord" ? "Connexion en cours…" : "Continuer avec Discord"}
        </Button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-600">
          <span className="h-px flex-1 bg-neutral-800" />
          ou
          <span className="h-px flex-1 bg-neutral-800" />
        </div>

        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {mode === "signup" && (
            <Field
              label="Pseudo (optionnel)"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}
          {mode !== "forgot" && (
            <Field
              label="Mot de passe"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}

          {error && <Notice kind="error">{error}</Notice>}
          {notice && <Notice kind="info">{notice}</Notice>}

          <Button type="submit" disabled={busy !== null}>
            {busy === "email" ? "…" : TITLES[mode]}
          </Button>
        </form>

        <div className="flex flex-col gap-1 text-sm text-neutral-400">
          {mode === "signin" && (
            <>
              <button
                className="text-left hover:text-neutral-200"
                onClick={() => switchTo("signup")}
              >
                Pas de compte ? En créer un
              </button>
              <button
                className="text-left hover:text-neutral-200"
                onClick={() => switchTo("forgot")}
              >
                Mot de passe oublié ?
              </button>
            </>
          )}
          {mode !== "signin" && (
            <button className="text-left hover:text-neutral-200" onClick={() => switchTo("signin")}>
              Revenir à la connexion
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
