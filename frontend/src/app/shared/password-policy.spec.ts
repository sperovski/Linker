import { passwordStrength, validatePassword } from './password-policy';

/**
 * These mirror the server's PasswordPolicyTests. When the two disagree the
 * server wins — but a disagreement means the meter is lying to the user, so
 * the cases are kept deliberately parallel.
 */
describe('validatePassword', () => {
  it('accepts a password meeting every rule', () => {
    expect(validatePassword('Fixture-Pass-1')).toBeNull();
    expect(validatePassword('correct horse9B')).toBeNull();
  });

  it('rejects a password shorter than the minimum', () => {
    expect(validatePassword('Ab1-xyz')).toContain('at least');
  });

  it('rejects a password spanning too few character classes', () => {
    expect(validatePassword('banana bread flour')).toContain('three of');
  });

  it('rejects a common password', () => {
    expect(validatePassword('Password123')).toContain('too common');
  });

  it('rejects predictable runs', () => {
    expect(validatePassword('abcdefghijkl')).toContain('predictable');
    expect(validatePassword('9876543210')).toContain('predictable');
    expect(validatePassword('aaaaaaaaaaaa')).toContain('predictable');
  });

  it("rejects a password containing the account's own email", () => {
    expect(validatePassword('Marko.Ilievski-42', 'marko.ilievski@example.com')).toContain(
      'email address',
    );
  });

  it('applies no email rule when no email is supplied', () => {
    expect(validatePassword('Marko.Ilievski-42')).toBeNull();
  });

  it('rejects an empty password', () => {
    expect(validatePassword('')).not.toBeNull();
  });
});

describe('passwordStrength', () => {
  it('reports empty for no input', () => {
    expect(passwordStrength('')).toBe('empty');
  });

  it('reports weak for anything the policy rejects', () => {
    expect(passwordStrength('short')).toBe('weak');
    expect(passwordStrength('Password123')).toBe('weak');
  });

  it('rises with length and character variety', () => {
    // 11 chars over exactly three classes: passes, but only just.
    expect(passwordStrength('Fixturepas1')).toBe('fair');
    expect(passwordStrength('Fixture-Pass-1')).toBe('good');
    expect(passwordStrength('Fixture-Passphrase-1')).toBe('strong');
  });
});
