type ObservabilityValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ObservabilityValue[]
  | { [key: string]: ObservabilityValue };

type ObservabilityContext = Record<string, ObservabilityValue>;

function sanitizeValue(value: ObservabilityValue): ObservabilityValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)])
  );
}

function emit(level: "info" | "warn" | "error", event: string, context: ObservabilityContext) {
  const sanitizedContext = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(value)])
  );
  const payload = {
    at: new Date().toISOString(),
    level,
    event,
    service: "grandmate-web",
    ...sanitizedContext
  };

  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.log(message);
}

export function logInfo(event: string, context: ObservabilityContext = {}) {
  emit("info", event, context);
}

export function logWarn(event: string, context: ObservabilityContext = {}) {
  emit("warn", event, context);
}

export function logError(event: string, context: ObservabilityContext = {}) {
  emit("error", event, context);
}
