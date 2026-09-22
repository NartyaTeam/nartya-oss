import { useState } from "react";
import type { AuthFlows } from "../features/auth/flows.ts";
import { translateAuthError } from "../lib/auth-errors.ts";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Notice } from "../ui/Notice.tsx";

// Reached with a recovery session already in hand: the link has been exchanged, so the only
// thing left is choosing the password.
export function NewPasswordPage({ flows, onDone }: { flows: AuthFlows; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (password.length < 6) {
      setError("Mot de passe trop court (6 caractères minimum).");
      return;
    }
    if (password !== again) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      const result = await flows.setPassword(password);
      if (result.error) setError(translateAuthError(result.error));
      else onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        <div>
          <h1 className="font-display text-3xl font-black">Nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-muted">Choisis-en un que tu n'utilises ailleurs.</p>
        </div>

        <Field
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          label="Confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={again}
          onChange={(event) => setAgain(event.target.value)}
        />

        {error && <Notice kind="error">{error}</Notice>}

        <Button type="submit" disabled={busy}>
          {busy ? "…" : "Enregistrer"}
        </Button>
      </form>
    </main>
  );
}
