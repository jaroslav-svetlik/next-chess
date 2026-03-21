const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  if (!value) {
    return "Username is required.";
  }

  if (value.length < 3) {
    return "Username must have at least 3 characters.";
  }

  if (value.length > 24) {
    return "Username must be 24 characters or fewer.";
  }

  if (!USERNAME_PATTERN.test(value)) {
    return "Use only lowercase letters, numbers and underscores for username.";
  }

  return null;
}
