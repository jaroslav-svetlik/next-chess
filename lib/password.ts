const MIN_STRONG_PASSWORD_LENGTH = 12;
const PASSWORD_UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASSWORD_LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const PASSWORD_DIGITS = "23456789";
const PASSWORD_SYMBOLS = "!@#$%^&*-_=+?";

const COMMON_PASSWORD_FRAGMENTS = [
  "password",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "1234",
  "abcd",
  "nextchess",
  "chess"
];

const SEQUENTIAL_PATTERN = /(0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|qwer|asdf|zxcv)/i;

export type PasswordStrength = {
  score: number;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Very strong";
};

function randomIndex(max: number) {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % max;
}

function pickCharacter(source: string) {
  return source[randomIndex(source.length)];
}

function shuffle(values: string[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

export function validateStrongPassword(password: string) {
  if (password.length < MIN_STRONG_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_STRONG_PASSWORD_LENGTH} characters long.`;
  }

  if (/\s/.test(password)) {
    return "Password cannot contain spaces.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one symbol.";
  }

  if (/(.)\1{3,}/.test(password)) {
    return "Password cannot repeat the same character 4 or more times in a row.";
  }

  const normalized = password.toLowerCase();

  if (COMMON_PASSWORD_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return "Password is too easy to guess. Avoid common words and patterns.";
  }

  if (SEQUENTIAL_PATTERN.test(normalized)) {
    return "Password is too easy to guess. Avoid keyboard and number sequences.";
  }

  return null;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "Too weak"
    };
  }

  let score = 0;

  if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= MIN_STRONG_PASSWORD_LENGTH) {
    score += 1;
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  if (password.length >= 16) {
    score += 1;
  }

  if (/(.)\1{3,}/.test(password)) {
    score = Math.max(score - 2, 0);
  }

  const normalized = password.toLowerCase();

  if (COMMON_PASSWORD_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    score = Math.max(score - 2, 0);
  }

  if (SEQUENTIAL_PATTERN.test(normalized)) {
    score = Math.max(score - 2, 0);
  }

  if (score <= 1) {
    return { score: 1, label: "Too weak" };
  }

  if (score === 2) {
    return { score: 2, label: "Weak" };
  }

  if (score === 3) {
    return { score: 3, label: "Fair" };
  }

  if (score <= 5) {
    return { score: 4, label: "Strong" };
  }

  return { score: 5, label: "Very strong" };
}

export function generateStrongPassword(length = 18) {
  const resolvedLength = Math.max(length, MIN_STRONG_PASSWORD_LENGTH);
  const alphabet =
    PASSWORD_UPPERCASE + PASSWORD_LOWERCASE + PASSWORD_DIGITS + PASSWORD_SYMBOLS;
  let generatedPassword = "";

  do {
    const passwordCharacters = [
      pickCharacter(PASSWORD_UPPERCASE),
      pickCharacter(PASSWORD_LOWERCASE),
      pickCharacter(PASSWORD_DIGITS),
      pickCharacter(PASSWORD_SYMBOLS)
    ];

    while (passwordCharacters.length < resolvedLength) {
      passwordCharacters.push(pickCharacter(alphabet));
    }

    shuffle(passwordCharacters);
    generatedPassword = passwordCharacters.join("");
  } while (validateStrongPassword(generatedPassword));

  return generatedPassword;
}

export { MIN_STRONG_PASSWORD_LENGTH };
