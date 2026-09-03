import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';

describe('WalletService (Unit Tests)', () => {
  let walletService: WalletService;
  let mockWalletRepository: any;

  const mockWallet: Wallet = {
    id: 'w1a2b3c4-d5e6-7890-abcd-ef1234567890',
    userId: 'u1a2b3c4-d5e6-7890-abcd-ef1234567890',
    balance: '0.0000',
    currency: 'NGN',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null as any,
  };

  beforeEach(async () => {
    mockWalletRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((wallet) =>
          Promise.resolve({ id: mockWallet.id, ...wallet }),
        ),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
      ],
    }).compile();

    walletService = module.get<WalletService>(WalletService);
  });

  describe('createWalletForUser()', () => {
    it('should create an initial wallet with 0.0000 balance and default NGN currency', async () => {
      const result = await walletService.createWalletForUser(mockWallet.userId);

      expect(mockWalletRepository.create).toHaveBeenCalledWith({
        userId: mockWallet.userId,
        balance: '0.0000',
        currency: 'NGN',
      });
      expect(mockWalletRepository.save).toHaveBeenCalled();
      expect(result.balance).toBe('0.0000');
      expect(result.currency).toBe('NGN');
    });

    it('should use provided transactional EntityManager if passed', async () => {
      const mockManagerRepo = {
        create: jest.fn().mockImplementation((dto) => dto),
        save: jest.fn().mockImplementation((dto) => Promise.resolve(dto)),
      };
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(mockManagerRepo),
      };

      await walletService.createWalletForUser(
        mockWallet.userId,
        'NGN',
        mockManager as any,
      );

      expect(mockManager.getRepository).toHaveBeenCalledWith(Wallet);
      expect(mockManagerRepo.create).toHaveBeenCalled();
      expect(mockManagerRepo.save).toHaveBeenCalled();
      expect(mockWalletRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getWalletByUserId()', () => {
    it('should return wallet if it exists for user', async () => {
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);

      const result = await walletService.getWalletByUserId(mockWallet.userId);

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockWallet.userId },
      });
    });

    it('should lazily auto-provision wallet if it does not exist (self-healing)', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      const result = await walletService.getWalletByUserId(mockWallet.userId);

      expect(mockWalletRepository.create).toHaveBeenCalledWith({
        userId: mockWallet.userId,
        balance: '0.0000',
        currency: 'NGN',
      });
      expect(result.currency).toBe('NGN');
      expect(result.balance).toBe('0.0000');
    });
  });

  describe('fundWallet()', () => {
    it('should deposit funds and correctly update balance with 4 decimal places', async () => {
      mockWalletRepository.findOne.mockResolvedValue({
        ...mockWallet,
        balance: '1000.0000',
      });
      mockWalletRepository.save.mockImplementation((w: any) =>
        Promise.resolve(w),
      );

      const result = await walletService.fundWallet(mockWallet.userId, {
        amount: 2500.5,
      });

      expect(result.balance).toBe('3500.5000');
      expect(mockWalletRepository.save).toHaveBeenCalled();
    });

    it('should auto-provision and fund wallet if it does not exist when funding', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      const result = await walletService.fundWallet(mockWallet.userId, {
        amount: 2500.5,
      });

      expect(result.balance).toBe('2500.5000');
      expect(mockWalletRepository.save).toHaveBeenCalled();
    });
  });
});
