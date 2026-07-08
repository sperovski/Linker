import { SelectOption } from './select.component';

/**
 * The 23 faculties of Ss. Cyril and Methodius University in Skopje (UKIM) —
 * the options offered for the student "faculty" field at sign-up and on the
 * profile page. Stored as plain text in the profile's `university` field.
 */
export const UKIM_FACULTIES: string[] = [
  'Faculty of Agricultural Sciences and Food',
  'Faculty of Architecture',
  'Faculty of Civil Engineering',
  'Faculty of Computer Science and Engineering (FINKI)',
  'Faculty of Dentistry',
  'Faculty of Design and Technologies of Furniture and Interior',
  'Faculty of Dramatic Arts',
  'Faculty of Economics – Skopje',
  'Faculty of Electrical Engineering and Information Technologies (FEIT)',
  'Faculty of Fine Arts',
  'Faculty of Law “Iustinianus Primus”',
  'Faculty of Mechanical Engineering',
  'Faculty of Medicine',
  'Faculty of Music',
  'Faculty of Natural Sciences and Mathematics',
  'Faculty of Pedagogy “St. Kliment Ohridski”',
  'Faculty of Pharmacy',
  'Faculty of Philology “Blaže Koneski”',
  'Faculty of Philosophy',
  'Faculty of Physical Education, Sport and Health',
  'Faculty of Technology and Metallurgy',
  'Faculty of Veterinary Medicine',
  'Hans Em Faculty of Forest Sciences, Landscape Architecture and Environmental Engineering',
];

export function facultyOptions(): SelectOption[] {
  return [
    { value: '', label: 'Choose your faculty… (optional)' },
    ...UKIM_FACULTIES.map((name) => ({ value: name, label: name })),
  ];
}

/**
 * Graduation years from the current year forward — students can't have
 * already graduated. `extra` prepends a legacy value so older profiles
 * created before this rule still display and save correctly.
 */
export function gradYearOptions(span = 8, extra?: number | null): SelectOption[] {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: span }, (_, i) => currentYear + i);
  if (extra && !years.includes(extra)) {
    years.unshift(extra);
  }
  return [
    { value: '', label: 'Choose a year… (optional)' },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];
}
