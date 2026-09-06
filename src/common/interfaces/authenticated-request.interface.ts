import { Request } from 'express';
import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  roles: UserRole[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
