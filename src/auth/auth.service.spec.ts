import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { UserRole } from '../users/entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService (Unit Tests)', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let walletService: jest.Mocked<Partial<WalletService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const mockUser = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'test@fintech.com',
    password: '$2b$10$mockHashedPasswordExample',
    refreshToken: '$2b$10$mockHashedRefreshTokenExample',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByEmailWithSecrets: jest.fn(),
      findById: jest.fn(),
      findByIdWithRefreshToken: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    walletService = {
      createWalletForUser: jest.fn().mockResolvedValue({
        id: 'mock-wallet-id',
        userId: mockUser.id,
        balance: '0.0000',
        currency: 'NGN',
      } as any),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-jwt-token'),
      verifyAsync: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const configMap: Record<string, string> = {
          JWT_SECRET: 'test-access-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_EXPIRES: '15m',
          JWT_REFRESH_EXPIRES: '7d',
        };
        return configMap[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: WalletService, useValue: walletService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('should successfully register a new user and return user info with token pair', async () => {
      usersService.findByEmail!.mockResolvedValue(null);
      usersService.create!.mockResolvedValue(mockUser as any);
      usersService.updateRefreshToken!.mockResolvedValue(undefined);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_value');

      const result = await authService.register({
        email: 'test@fintech.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@fintech.com');
      expect(result.tokens.accessToken).toBe('mocked-jwt-token');
      expect(usersService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email is already taken', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);

      await expect(
        authService.register({
          email: 'test@fintech.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      usersService.findByEmailWithSecrets!.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_refresh');

      const result = await authService.login({
        email: 'test@fintech.com',
        password: 'Password123!',
      });

      expect(result.user.email).toBe('test@fintech.com');
      expect(result.tokens).toBeDefined();
      expect(usersService.updateRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException if email does not exist', async () => {
      usersService.findByEmailWithSecrets!.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'wrong@fintech.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password hash does not match', async () => {
      usersService.findByEmailWithSecrets!.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'test@fintech.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user account is deactivated', async () => {
      usersService.findByEmailWithSecrets!.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(
        authService.login({
          email: 'test@fintech.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken()', () => {
    it('should rotate tokens and return a fresh token pair when valid', async () => {
      jwtService.verifyAsync!.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      usersService.findByIdWithRefreshToken!.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('rotated_hash');

      const tokens = await authService.refreshToken({
        refreshToken: 'valid-refresh-token',
      });

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(usersService.updateRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException if refresh token signature is invalid or expired', async () => {
      jwtService.verifyAsync!.mockRejectedValue(new Error('jwt expired'));

      await expect(
        authService.refreshToken({
          refreshToken: 'expired-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token does not match stored hash', async () => {
      jwtService.verifyAsync!.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      usersService.findByIdWithRefreshToken!.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.refreshToken({
          refreshToken: 'tampered-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout()', () => {
    it('should revoke session by clearing refresh token hash in database', async () => {
      usersService.updateRefreshToken!.mockResolvedValue(undefined);

      const result = await authService.logout(mockUser.id);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        null,
      );
    });
  });
});
