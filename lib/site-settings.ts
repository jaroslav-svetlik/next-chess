import { db } from "@/lib/db";

const SETTINGS_KEYS = {
  arenaChatGuestsEnabled: "arenaChatGuestsEnabled"
} as const;

const BOOLEAN_DEFAULTS: Record<string, boolean> = {
  [SETTINGS_KEYS.arenaChatGuestsEnabled]: true
};

function normalizeBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

async function getBooleanSetting(key: string) {
  const setting = await db.appSetting.findUnique({
    where: {
      key
    },
    select: {
      value: true
    }
  });

  return normalizeBoolean(setting?.value, BOOLEAN_DEFAULTS[key] ?? false);
}

async function setBooleanSetting(key: string, value: boolean) {
  const setting = await db.appSetting.upsert({
    where: {
      key
    },
    update: {
      value: value ? "true" : "false"
    },
    create: {
      key,
      value: value ? "true" : "false"
    },
    select: {
      key: true,
      value: true,
      updatedAt: true
    }
  });

  return {
    key: setting.key,
    value: normalizeBoolean(setting.value, value),
    updatedAt: setting.updatedAt.toISOString()
  };
}

export async function getArenaChatGuestPostingEnabled() {
  return getBooleanSetting(SETTINGS_KEYS.arenaChatGuestsEnabled);
}

export async function updateArenaChatGuestPostingEnabled(value: boolean) {
  return setBooleanSetting(SETTINGS_KEYS.arenaChatGuestsEnabled, value);
}
