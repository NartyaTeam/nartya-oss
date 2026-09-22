export function MissingConfig({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text">
      <h1 className="text-xl font-semibold">Configuration incomplète</h1>
      <p className="text-sm text-muted">
        Copiez <code className="text-text">.env.example</code> vers{" "}
        <code className="text-text">.env</code>, puis renseignez :
      </p>
      <ul className="text-sm text-text/90">
        {missing.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
