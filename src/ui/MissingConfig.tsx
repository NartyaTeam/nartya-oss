export function MissingConfig({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-neutral-100">
      <h1 className="text-xl font-semibold">Configuration incomplète</h1>
      <p className="text-sm text-neutral-400">
        Copiez <code className="text-neutral-200">.env.example</code> vers{" "}
        <code className="text-neutral-200">.env</code>, puis renseignez :
      </p>
      <ul className="text-sm text-neutral-300">
        {missing.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
