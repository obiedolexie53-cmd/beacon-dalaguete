export type UserRole = 'resident' | 'mdrrmo' | 'admin';

export interface Barangay {
  id: number;
  name: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  barangay: Barangay | null;
  is_demo: boolean;
}

export interface SessionResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: UserProfile;
}

export interface RegisterRequest {
  full_name: string;
  email: string | null;
  phone: string | null;
  barangay_id: number;
  password: string;
  privacy_consent: boolean;
}
