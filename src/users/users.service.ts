import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { User } from './entities/user.entity';

/**
 * UsersService
 *
 * WHAT IT DOES:
 * Encapsulates all database operations for the User entity.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. Encapsulated Secrets Retrieval (`findByEmailWithSecrets`):
 *    In our `User` entity, `password` and `refreshToken` are configured with `select: false`.
 *    This means standard `findOne({ where: { email } })` calls will NEVER return the password
 *    or token hash.
 *    For authentication, however, `AuthService` must verify the password hash.
 *    Instead of removing `select: false` (which risks leaking password hashes across the app),
 *    we provide a dedicated `findByEmailWithSecrets()` method that uses TypeORM's
 *    `createQueryBuilder` to explicitly request `.addSelect('user.password')`.
 *
 * 2. Separation of Concerns:
 *    `UsersService` does NOT handle HTTP logic, hashing, or token signing.
 *    It only manages user data persistence and queries.
 *    `AuthService` depends on `UsersService` to read/write users.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Persists a new user record.
   */
  async create(userData: DeepPartial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  /**
   * Finds a user by email WITHOUT sensitive columns (password, refreshToken).
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Finds a user by email INCLUDING password and refreshToken hash.
   * STRICTLY intended for authentication services.
   */
  async findByEmailWithSecrets(email: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.refreshToken')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  /**
   * Finds a user by their UUID primary key (sanitized, no secrets).
   */
  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * Finds a user by ID INCLUDING the refreshToken hash for token rotation checks.
   */
  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .where('user.id = :id', { id })
      .getOne();
  }

  /**
   * Updates or revokes (null) the user's hashed refresh token.
   */
  async updateRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: hashedRefreshToken ?? undefined,
    });
  }
}
