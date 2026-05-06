import { env } from '../../../config/env.js';
import type { LoginBody } from '../schemas/auth.schemas.js';
import { AuthRepository } from '../infrastructure/auth.repository.js';
import { signJwt } from './jwt.js';
import { verifyPassword } from './password.js';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async login(input: LoginBody) {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthServiceError('Invalid credentials', 401);
    }

    const userRole = await this.authRepository.findUserRole(
      user.id,
      input.institutionId
    );

    if (!userRole) {
      throw new AuthServiceError('User role for this institution was not found', 403);
    }

    const token = signJwt(
      {
        sub: user.id,
        institutionId: input.institutionId,
      },
      env.JWT_SECRET
    );

    return {
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          institutionId: userRole.institutionId,
          role: userRole.role,
        },
      },
    };
  }
}
