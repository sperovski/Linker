import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Client-side mirror of the server's `PasswordPolicy`. It exists so the meter
 * and the inline error can react as the user types — the server re-runs the
 * same rules on every write path and remains the only thing that decides, so a
 * drift here weakens the hint, never the gate.
 */
export const MIN_PASSWORD_LENGTH = 10;
const REQUIRED_CHARACTER_CLASSES = 3;

const BLOCKLIST = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword1',
  '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', '1q2w3e4r',
  'letmein123', 'welcome123', 'admin12345', 'administrator', 'iloveyou1',
  'linkerlinker', 'linker1234', 'internship', 'internship1', 'studentpass',
  'changeme123', 'secret1234', 'trustno1234', 'monkey12345', 'dragon12345',
]);

export function countCharacterClasses(password: string): number {
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^a-zA-Z0-9]/.test(password)) classes++;
  return classes;
}

/** True when the whole password is one ascending or descending run ("abcdefghij"). */
function isSequential(password: string): boolean {
  if (password.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < password.length; i++) {
    const delta = password.charCodeAt(i) - password.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
}

function isSingleRepeatedCharacter(password: string): boolean {
  return new Set(password).size === 1;
}

/** Returns null when acceptable, otherwise the message to show. Mirrors the server's order. */
export function validatePassword(password: string, email?: string | null): string | null {
  if (!password) return 'A password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 100) return 'Password cannot exceed 100 characters.';
  if (password.trim().length !== password.length) {
    return 'Password cannot start or end with a space.';
  }
  if (BLOCKLIST.has(password.toLowerCase())) {
    return 'That password is too common. Pick something less predictable.';
  }
  if (isSingleRepeatedCharacter(password) || isSequential(password)) {
    return 'Password is too predictable. Avoid repeated or sequential characters.';
  }
  if (countCharacterClasses(password) < REQUIRED_CHARACTER_CLASSES) {
    return 'Password must combine at least three of: lowercase letters, uppercase letters, numbers, symbols.';
  }
  const localPart = email?.split('@')[0];
  if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart.toLowerCase())) {
    return 'Password cannot contain your email address.';
  }
  return null;
}

/**
 * Reactive-forms validator. Pass a getter for the email control so the
 * "don't reuse your address" rule can apply here too, as it does server-side.
 */
export function strongPasswordValidator(emailOf?: () => string | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '') as string;
    // Leave "required" to Validators.required so an untouched empty field
    // doesn't shout a policy error at someone who hasn't typed yet.
    if (!value) return null;
    const failure = validatePassword(value, emailOf?.());
    return failure ? { strongPassword: failure } : null;
  };
}

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

/**
 * A coarse 0–4 read used only to colour the meter. Length dominates because it
 * is what actually costs an attacker time; character classes break ties.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'empty';
  if (validatePassword(password) !== null) return 'weak';

  const classes = countCharacterClasses(password);
  if (password.length >= 16 && classes >= 3) return 'strong';
  if (password.length >= 12 || classes === 4) return 'good';
  return 'fair';
}
