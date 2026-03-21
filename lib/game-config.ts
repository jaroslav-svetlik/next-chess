import { GameVisibility, TimeCategory } from "@prisma/client";

export const CONTROL_PRESETS = [
  {
    label: "Bullet",
    timeCategory: TimeCategory.BULLET,
    control: "1+0",
    initialTimeMs: 60_000,
    incrementMs: 0
  },
  {
    label: "Bullet",
    timeCategory: TimeCategory.BULLET,
    control: "2+1",
    initialTimeMs: 120_000,
    incrementMs: 1_000
  },
  {
    label: "Blitz",
    timeCategory: TimeCategory.BLITZ,
    control: "3+0",
    initialTimeMs: 180_000,
    incrementMs: 0
  },
  {
    label: "Blitz",
    timeCategory: TimeCategory.BLITZ,
    control: "3+2",
    initialTimeMs: 180_000,
    incrementMs: 2_000
  },
  {
    label: "Blitz",
    timeCategory: TimeCategory.BLITZ,
    control: "5+0",
    initialTimeMs: 300_000,
    incrementMs: 0
  },
  {
    label: "Rapid",
    timeCategory: TimeCategory.RAPID,
    control: "10+0",
    initialTimeMs: 600_000,
    incrementMs: 0
  },
  {
    label: "Rapid",
    timeCategory: TimeCategory.RAPID,
    control: "10+5",
    initialTimeMs: 600_000,
    incrementMs: 5_000
  },
  {
    label: "Rapid",
    timeCategory: TimeCategory.RAPID,
    control: "15+10",
    initialTimeMs: 900_000,
    incrementMs: 10_000
  }
] as const;

export const DEFAULT_CONTROL = CONTROL_PRESETS[3];

export type CreateGameInput = {
  format?: string;
  control?: string;
  visibility?: string;
  initialMinutes?: number;
  incrementSeconds?: number;
};

export type NormalizedGameSetup = {
  label: string;
  timeCategory: TimeCategory;
  initialTimeMs: number;
  incrementMs: number;
  visibility: GameVisibility;
  control: string;
};

function parseVisibility(value?: string) {
  return value?.toUpperCase() === GameVisibility.PRIVATE ? GameVisibility.PRIVATE : GameVisibility.PUBLIC;
}

export function normalizeGameSetup(input: CreateGameInput): NormalizedGameSetup {
  const visibility = parseVisibility(input.visibility);
  const preset = CONTROL_PRESETS.find((option) => option.control === input.control);

  if (input.format?.toUpperCase() === TimeCategory.CUSTOM || input.control === "custom") {
    const initialMinutes = Number.isFinite(input.initialMinutes) ? Number(input.initialMinutes) : 10;
    const incrementSeconds = Number.isFinite(input.incrementSeconds)
      ? Number(input.incrementSeconds)
      : 5;

    const safeInitialMinutes = Math.min(Math.max(initialMinutes, 1), 180);
    const safeIncrementSeconds = Math.min(Math.max(incrementSeconds, 0), 60);

    return {
      label: "Custom",
      timeCategory: TimeCategory.CUSTOM,
      initialTimeMs: safeInitialMinutes * 60_000,
      incrementMs: safeIncrementSeconds * 1_000,
      visibility,
      control: `${safeInitialMinutes}+${safeIncrementSeconds}`
    };
  }

  if (!preset) {
    return {
      ...DEFAULT_CONTROL,
      visibility
    };
  }

  return {
    ...preset,
    visibility
  };
}

export function formatControl(initialTimeMs: number, incrementMs: number) {
  return `${Math.round(initialTimeMs / 60_000)}+${Math.round(incrementMs / 1_000)}`;
}

export function formatCategoryLabel(timeCategory: TimeCategory) {
  return timeCategory.charAt(0) + timeCategory.slice(1).toLowerCase();
}
