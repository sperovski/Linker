export type UserRole = 'Student' | 'Company' | 'Admin';

export type InternshipType = 'Internship' | 'PartTime' | 'FullTime';

export type ApplicationStatus = 'Submitted' | 'UnderReview' | 'Accepted' | 'Rejected' | 'Withdrawn';

export interface AuthResponse {
  userId: number;
  email: string;
  role: UserRole;
  token: string;
  refreshToken: string;
  emailVerified: boolean;
}

export interface NotificationItem {
  id: number;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAtUtc: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unreadCount: number;
}

export interface AdminUser {
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAtUtc: string;
}

export interface AdminInternship {
  id: number;
  title: string;
  companyName: string;
  isActive: boolean;
  createdAtUtc: string;
}

export interface AdminCompany {
  id: number;
  name: string;
  email: string;
  website: string | null;
  isVerified: boolean;
  emailVerified: boolean;
  isActive: boolean;
  listingCount: number;
  createdAtUtc: string;
}

export interface AdminStats {
  totalUsers: number;
  students: number;
  companies: number;
  totalInternships: number;
  activeInternships: number;
}

export interface RegisterStudentRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  university?: string | null;
  graduationYear?: number | null;
}

export interface RegisterCompanyRequest {
  email: string;
  password: string;
  name: string;
  description?: string | null;
  website?: string | null;
}

export interface SkillResponse {
  id: number;
  name: string;
  category: string;
}

export interface ExperienceEntry {
  id: number;
  title: string;
  company: string;
  location: string | null;
  startDate: string; // ISO date (yyyy-MM-dd)
  endDate: string | null; // null = current position
  description: string | null;
}

export interface SaveExperienceRequest {
  title: string;
  company: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
}

export interface EducationEntry {
  id: number;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string;
  endDate: string | null; // null = still enrolled
}

export interface SaveEducationRequest {
  institution: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate: string;
  endDate?: string | null;
}

export interface ProjectEntry {
  id: number;
  title: string;
  description: string | null;
  url: string | null;
  techStack: string | null; // comma-separated tags
}

export interface SaveProjectRequest {
  title: string;
  description?: string | null;
  url?: string | null;
  techStack?: string | null;
}

export interface StudentProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  headline: string | null;
  profilePhotoUrl: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  cvUrl: string | null;
  skills: SkillResponse[];
  experiences: ExperienceEntry[];
  educations: EducationEntry[];
  projects: ProjectEntry[];
}

/** Result of a CV upload: the saved profile plus what reading the file imported. */
export interface CvImportResponse {
  profile: StudentProfile;
  addedSkills: string[];
  /** Set only when the student already had a bio, so theirs was left alone. */
  suggestedBio: string | null;
  bioApplied: boolean;
  /** False when no text could be read (e.g. a scanned, image-only PDF). */
  textExtracted: boolean;
}

export interface UpdateStudentProfileRequest {
  firstName: string;
  lastName: string;
  university?: string | null;
  graduationYear?: number | null;
  bio?: string | null;
  headline?: string | null;
  profilePhotoUrl?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  cvUrl?: string | null;
}

export interface CompanyProfile {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  website: string | null;
  /** Admin-granted; read-only here — updating the profile never changes it. */
  isVerified: boolean;
}

export interface UpdateCompanyProfileRequest {
  name: string;
  description?: string | null;
  website?: string | null;
}

export interface InternshipListItem {
  id: number;
  title: string;
  location: string | null;
  type: InternshipType;
  companyName: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  applicationDeadline: string | null;
  requiredSkills: SkillResponse[];
  matchScore: number | null;
  isSaved: boolean;
  /** Numerator/denominator behind matchScore; null whenever matchScore is null. */
  matchedSkillCount: number | null;
  requiredSkillCount: number | null;
  hasApplied: boolean;
}

export interface InternshipDetail {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  description: string;
  location: string | null;
  type: InternshipType;
  startDate: string | null;
  endDate: string | null;
  applicationDeadline: string | null;
  isActive: boolean;
  createdAtUtc: string;
  requiredSkills: SkillResponse[];
  matchScore: number | null;
  isSaved: boolean;
}

export interface CreateInternshipRequest {
  title: string;
  description: string;
  location?: string | null;
  type: InternshipType;
  startDate?: string | null;
  endDate?: string | null;
  applicationDeadline?: string | null;
  skillIds?: number[];
}

export interface CompanyDashboard {
  totalListings: number;
  activeListings: number;
  totalApplicants: number;
  pendingApplicants: number;
  acceptedApplicants: number;
  listings: DashboardListing[];
  recentApplicants: DashboardApplicant[];
}

export interface DashboardListing {
  id: number;
  title: string;
  isActive: boolean;
  applicationDeadline: string | null;
  applicantCount: number;
  pendingCount: number;
}

export interface DashboardApplicant {
  applicationId: number;
  studentName: string;
  internshipId: number;
  internshipTitle: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface InternshipSearchFilters {
  location?: string;
  searchText?: string;
  type?: InternshipType | '';
  company?: string;
  page?: number;
  pageSize?: number;
}

/** One page of results plus the total across all pages. */
export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A company in the current result set, with its open-role count. */
export interface CompanyFacet {
  name: string;
  count: number;
}

/**
 * Search results. `companies` is computed over the whole result set ignoring the
 * company filter, so selecting one doesn't collapse the dropdown to that company.
 */
export interface InternshipSearchResponse extends PagedResponse<InternshipListItem> {
  companies: CompanyFacet[];
}

export interface ApplicationResponse {
  id: number;
  studentId: number;
  studentName: string;
  internshipId: number;
  internshipTitle: string;
  companyName: string;
  status: ApplicationStatus;
  coverNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An application plus the applicant's profile, as the reviewing company sees it. */
export interface Applicant {
  id: number;
  studentId: number;
  studentName: string;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  skills: SkillResponse[];
  status: ApplicationStatus;
  coverNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationRequest {
  internshipId: number;
  coverNote?: string | null;
}

export interface CvReviewRequest {
  cvText: string;
  internshipId?: number | null;
}

export interface CvReviewResponse {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  matchedSkills: string[];
  missingSkills: string[];
  targetRole: string | null;
  roleFit: number | null;
  source: 'ai' | 'heuristic';
}

export interface CvFileReviewResponse {
  extractedText: string;
  fileName: string;
  review: CvReviewResponse;
}

export type ChatRoomType = 'General' | 'Company' | 'Internship';

export interface ChatRoomResponse {
  id: number;
  type: ChatRoomType;
  title: string;
  companyId: number | null;
  internshipId: number | null;
}

export interface ChatMessageResponse {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  body: string;
  createdAt: string;
  /**
   * Badge fields, all derived server-side from the sender's account. The UI
   * renders them as-is and never infers a company from a display name — that
   * distinction is exactly what the badge exists to make trustworthy.
   */
  senderRole: UserRole;
  senderCompanyName: string | null;
  isVerifiedCompany: boolean;
}

/** The signed-in account as its owner sees it, for the settings page. */
export interface Account {
  userId: number;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  /** A requested address awaiting confirmation; the login email hasn't moved yet. */
  pendingEmail: string | null;
  createdAtUtc: string;
}
