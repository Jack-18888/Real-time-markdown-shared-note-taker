export interface AuthUser {
  id: string;
  email: string;
}

export type Permission = 'read' | 'write' | 'owner';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}
