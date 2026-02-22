const integrations = ['HubSpot', 'Pipedrive', 'RD Station', 'Gmail', 'WhatsApp', 'Google Calendar'];

export function LogoBar() {
  return (
    <section className="border-y border-border/40 bg-muted/30 py-10">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          Integra com as ferramentas que você já usa
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {integrations.map((name) => (
            <span key={name} className="text-sm font-medium text-muted-foreground/70">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
