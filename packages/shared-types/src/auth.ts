export type UserRole = 'ADMIN' | 'MANAGER' | 'COLLECTION_AGENT' | 'ACCOUNTANT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  businessId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface JWTPayload {
  userId: string;
  businessId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
