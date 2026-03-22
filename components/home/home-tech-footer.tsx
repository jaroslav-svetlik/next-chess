type TechItem = {
  accentClass: string;
  description: string;
  mark: string;
  name: string;
};

const TECH_STACK: TechItem[] = [
  {
    name: "Next.js",
    description: "App Router shell",
    accentClass: "next",
    mark: "NX"
  },
  {
    name: "React 19",
    description: "Live client state",
    accentClass: "react",
    mark: "RC"
  },
  {
    name: "TypeScript",
    description: "Strict typed flow",
    accentClass: "typescript",
    mark: "TS"
  },
  {
    name: "Tailwind CSS",
    description: "Utility-first styling",
    accentClass: "tailwind",
    mark: "TW"
  },
  {
    name: "Prisma",
    description: "Data layer",
    accentClass: "prisma",
    mark: "PR"
  },
  {
    name: "PostgreSQL",
    description: "Persistent game state",
    accentClass: "postgres",
    mark: "PG"
  },
  {
    name: "Better Auth",
    description: "Sessions and accounts",
    accentClass: "auth",
    mark: "BA"
  }
];

export function HomeTechFooter() {
  return (
    <footer className="site-footer-stack glass-panel" aria-labelledby="site-tech-title">
      <div className="site-footer-copy">
        <span className="panel-kicker">Built with</span>
        <h2 className="site-footer-title" id="site-tech-title">
          Modern tooling, tuned for live chess.
        </h2>
        <p className="site-footer-text">
          The platform stack stays compact on purpose: fast UI delivery, typed backend paths,
          durable game state, and clean account handling.
        </p>
      </div>

      <div className="site-tech-grid" aria-label="Technologies used in NextChess">
        {TECH_STACK.map(({ accentClass, description, mark, name }) => (
          <article className="site-tech-card" key={name}>
            <span className={`site-tech-logo ${accentClass}`} aria-hidden="true">
              <span className="site-tech-wordmark">{mark}</span>
            </span>
            <div className="site-tech-meta">
              <strong>{name}</strong>
              <span>{description}</span>
            </div>
          </article>
        ))}
      </div>
    </footer>
  );
}
