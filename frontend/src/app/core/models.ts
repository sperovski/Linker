export type UserRole = 'Student' | 'Company' | 'Admin';

export type InternshipType = 'Internship' | 'PartTime' | 'FullTime';

export type ApplicationStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Withdrawn';

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
}

export interface StudentProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  skills: SkillResponse[];
}

export interface UpdateStudentProfileRequest {
  firstName: string;
  lastName: string;
  university?: string | null;
  graduationYear?: number | null;
  bio?: string | null;
}

export interface CompanyProfile {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  website: string | null;
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
  appliedAtUtc: string;
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
  coverLetter: string | null;
  appliedAtUtc: string;
}

export interface CreateApplicationRequest {
  internshipId: number;
  coverLetter?: string | null;
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
