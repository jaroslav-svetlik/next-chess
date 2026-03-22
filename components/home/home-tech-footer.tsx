type TechItem = {
  accentClass: string;
  description: string;
  Icon: () => React.JSX.Element;
  name: string;
};

const TECH_STACK: TechItem[] = [
  {
    name: "Next.js",
    description: "App Router shell",
    accentClass: "next",
    Icon: NextJsLogo
  },
  {
    name: "React 19",
    description: "Live client state",
    accentClass: "react",
    Icon: ReactLogo
  },
  {
    name: "TypeScript",
    description: "Strict typed flow",
    accentClass: "typescript",
    Icon: TypeScriptLogo
  },
  {
    name: "Tailwind CSS",
    description: "Utility-first styling",
    accentClass: "tailwind",
    Icon: TailwindLogo
  },
  {
    name: "Prisma",
    description: "Data layer",
    accentClass: "prisma",
    Icon: PrismaLogo
  },
  {
    name: "PostgreSQL",
    description: "Persistent game state",
    accentClass: "postgres",
    Icon: PostgreSqlLogo
  },
  {
    name: "Better Auth",
    description: "Sessions and accounts",
    accentClass: "auth",
    Icon: BetterAuthLogo
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
        {TECH_STACK.map(({ accentClass, description, Icon, name }) => (
          <article className="site-tech-card" key={name}>
            <span className={`site-tech-logo ${accentClass}`} aria-hidden="true">
              <Icon />
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

function NextJsLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <circle cx="24" cy="24" fill="currentColor" r="18" />
      <path
        d="M18 32V16l12 16V16"
        stroke="#04101b"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.2"
      />
      <path d="M31 17l-8.5 14" stroke="#04101b" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function ReactLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <ellipse cx="24" cy="24" rx="16" ry="6.5" stroke="currentColor" strokeWidth="2.4" />
      <ellipse
        cx="24"
        cy="24"
        rx="16"
        ry="6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        transform="rotate(60 24 24)"
      />
      <ellipse
        cx="24"
        cy="24"
        rx="16"
        ry="6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        transform="rotate(120 24 24)"
      />
      <circle cx="24" cy="24" fill="currentColor" r="3.2" />
    </svg>
  );
}

function TypeScriptLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <rect fill="currentColor" height="30" rx="8" width="30" x="9" y="9" />
      <path
        d="M17 18h14M24 18v12M28.5 21.5h5M31 21.5v9M28.5 30.5h5"
        stroke="#04101b"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function TailwindLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <path
        d="M12 20c2.6-4.1 5.6-5.8 9-5.3 2 .3 3.5 1.5 5.1 2.9 2.5 2.1 5.2 4.4 10 4.4-2.6 4.1-5.6 5.8-9 5.3-2-.3-3.5-1.5-5.1-2.9-2.5-2.1-5.2-4.4-10-4.4Z"
        fill="currentColor"
      />
      <path
        d="M12 28c2.6-4.1 5.6-5.8 9-5.3 2 .3 3.5 1.5 5.1 2.9 2.5 2.1 5.2 4.4 10 4.4-2.6 4.1-5.6 5.8-9 5.3-2-.3-3.5-1.5-5.1-2.9-2.5-2.1-5.2-4.4-10-4.4Z"
        fill="currentColor"
        opacity="0.82"
      />
    </svg>
  );
}

function PrismaLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <path
        d="M22.7 10.2 14 21.1a4 4 0 0 0-.7 3.6l5.5 14.7a2.2 2.2 0 0 0 3.9.5l11.2-17a4.1 4.1 0 0 0 .5-3.7l-3.5-8.4a2.3 2.3 0 0 0-4.1-.6l-2.2 3.2c-.4.6-1.3.6-1.7 0l-.2-.2a2.1 2.1 0 0 0-.1-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PostgreSqlLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <ellipse cx="24" cy="15" fill="currentColor" rx="11" ry="5.2" />
      <path
        d="M13 15v9c0 2.9 4.9 5.2 11 5.2S35 26.9 35 24v-9"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M13 24v9c0 2.9 4.9 5.2 11 5.2S35 35.9 35 33v-9"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}

function BetterAuthLogo() {
  return (
    <svg fill="none" viewBox="0 0 48 48">
      <path
        d="M24 9.5 34.5 14v9.7c0 6.8-4.4 13-10.5 15.3C17.9 36.7 13.5 30.5 13.5 23.7V14L24 9.5Z"
        fill="currentColor"
      />
      <path
        d="M19 23.5h10M24 18.5v10"
        stroke="#04101b"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}
