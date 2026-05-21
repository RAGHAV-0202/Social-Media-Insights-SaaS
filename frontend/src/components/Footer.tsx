export function Footer() {
  return (
    <footer className="border-t border-border/60 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="font-serif-display text-lg tracking-tight font-semibold">Insights</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A quieter way to track social performance. Built for modern brands.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
          {[
            ["Product", ["Features", "Pricing", "Changelog"]],
            ["Company", ["About", "Careers", "Press"]],
            ["Legal", ["Privacy", "Terms", "Security"]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {h as string}
              </p>
              <ul className="space-y-1.5">
                {(items as string[]).map((i) => (
                  <li key={i}>
                    <a href="#" className="text-foreground/80 hover:text-foreground">
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl border-t border-border/60 pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Insights. Crafted with care.
      </div>
    </footer>
  );
}
