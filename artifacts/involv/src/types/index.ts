export type UserRole = 'student' | 'teacher' | 'organizer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  grade?: string;
  bio?: string;
  interests: string[];
  careerGoals: string[];
  skills: string[];
  availability: string[];
  preferredCategories: Category[];
  onboardingComplete?: boolean;
  createdAt?: string;
}

export type Category =
  | 'Sustainability & Environment'
  | 'Community & Social Impact'
  | 'Education & Mentorship'
  | 'Health & Wellbeing'
  | 'Arts, Culture & Media'
  | 'Technology & Innovation'
  | 'Business, Leadership & Management'
  | 'Global & Humanitarian'
  | 'School-Based Service';

export type LocationType = 'On-campus' | 'Off-campus' | 'Remote';
export type DurationType = 'One-time' | 'Ongoing' | 'Fixed period';
export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type ImpactType = 'Direct' | 'Indirect';
export type ApplicationStatus = 'Pending' | 'Under Review' | 'Accepted' | 'Rejected';
export type SortOption = 'newest' | 'deadline' | 'relevant' | 'popular';

export interface Opportunity {
  id: string;
  /** Supabase user ID of the organizer who created this listing */
  organizerId?: string;
  title: string;
  category: Category;
  shortDescription: string;
  fullDescription: string;
  organizerName: string;
  organizerRole: string;
  organizerEmail: string;
  locationType: LocationType;
  locationText: string;
  dates: string;
  timeCommitment: string;
  durationType: DurationType;
  skillLevel: SkillLevel;
  impactType: ImpactType;
  skillsRequired: string[];
  minGradeOrAge: string;
  languageRequirements: string[];
  positionsAvailable: number;
  applicationDeadline: string;
  startDate: string;
  skillsGained: string[];
  cvRelevance: string;
  impactDescription: string;
  tags: string[];
  featured: boolean;
  applicantsCount: number;
  /** 'active' | 'draft' | 'closed' | 'archived' — only 'active' shown to students */
  status?: string;
  createdAt: string;
}

export interface Application {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  applicantId: string;
  applicantName: string;
  applicantEmail?: string;
  grade: string;
  motivation: string;
  relevantExperience: string;
  availability: string;
  status: ApplicationStatus;
  submittedDate: string;
}

export interface FilterState {
  search: string;
  categories: Category[];
  locationType: LocationType | '';
  durationType: DurationType | '';
  skillLevel: SkillLevel | '';
  impactType: ImpactType | '';
  cvRelevant: boolean;
  sortBy: SortOption;
}

export interface Announcement {
  id: string;
  opportunityId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
}

export interface OppSession {
  id: string;
  opportunityId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  opportunityId: string;
  studentId: string;
  studentName: string;
  present: boolean | null;
}

export interface HoursEntry {
  id: string;
  opportunityId: string;
  studentId: string;
  studentName: string;
  date: string;
  hours: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface Reflection {
  id: string;
  opportunityId: string;
  sessionId?: string;
  studentId: string;
  studentName: string;
  content: string;
  submittedAt: string;
}

export interface GalleryPhoto {
  id: string;
  opportunityId: string;
  uploaderId: string;
  uploaderName: string;
  color: string;
  caption?: string;
  uploadedAt: string;
}
