/**
 * Maps a company name to a bundled logo asset. Matching is done on a normalised
 * (lowercased, alphanumeric-only) form so small naming differences between the
 * seed data and the asset filenames still resolve.
 */
const LOGO_RULES: { keyword: string; src: string; cover?: boolean }[] = [
  // Full-bleed square marks fill the tile edge-to-edge (cover); wordmark logos
  // sit padded on a white tile (contain).
  { keyword: 'netcetera', src: '/G+D.png', cover: true },
  { keyword: 'endava', src: 'assets/logos/endava.png' },
  { keyword: 'seavus', src: 'assets/logos/seavus.png' },
  { keyword: 'nlb', src: 'assets/logos/nlb.png' },
  { keyword: 'stopanska', src: 'assets/logos/stopanska.png' },
  { keyword: 'komercijalna', src: 'assets/logos/Komercijalna_Banka_AD_Skopje.png' },
  { keyword: 'alkaloid', src: 'assets/logos/alkaloid-skopje-01-logo-svg-vector.svg' },
  { keyword: 'replek', src: 'assets/logos/Replek-Farm-1-scaled.png' },
  { keyword: 'a1', src: 'assets/logos/a1_makedonija_logo.png' },
  { keyword: 'telekom', src: 'assets/logos/telekom.png' },
  { keyword: 'makstil', src: 'assets/logos/Makstil DITH logo header2.png' },
  { keyword: 'feni', src: 'assets/logos/feni.jpg' },
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchRule(name: string | null | undefined) {
  if (!name) {
    return null;
  }
  const norm = normalize(name);
  return LOGO_RULES.find((rule) => norm.includes(rule.keyword)) ?? null;
}

export function companyLogo(name: string | null | undefined): string | null {
  return matchRule(name)?.src ?? null;
}

/** Whether the matched logo should fill its tile (true) or sit padded (false). */
export function companyLogoCover(name: string | null | undefined): boolean {
  return matchRule(name)?.cover ?? false;
}

// Deterministic, pleasant gradient for companies without a bundled logo, so the
// fallback initials still feel branded rather than uniformly navy.
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #0369A1, #0EA5E9)',
  'linear-gradient(135deg, #7C3AED, #A855F7)',
  'linear-gradient(135deg, #059669, #10B981)',
  'linear-gradient(135deg, #DB2777, #F472B6)',
  'linear-gradient(135deg, #D97706, #F59E0B)',
  'linear-gradient(135deg, #4F46E5, #6366F1)',
  'linear-gradient(135deg, #0D9488, #14B8A6)',
  'linear-gradient(135deg, #DC2626, #F87171)',
];

export function companyGradient(name: string | null | undefined): string {
  if (!name) {
    return FALLBACK_GRADIENTS[0];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}
