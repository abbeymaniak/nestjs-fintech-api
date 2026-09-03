import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { WalletService } from '../wallet/wallet.service';

describe('TransactionsService (Unit Tests)', () => {
  let transactionsService: TransactionsService;
  let mockTransactionRepository: any;
  let mockWalletService: any;
  let mockQueryBuilder: any;

  const mockUser = {
    id: 'user-uuid-1111',
  };

  const mockWallet = {
    id: 'wallet-uuid-2222',
    userId: mockUser.id,
    balance: '5000.0000',
    currency: 'NGN',
  };

  const mockTransaction: Partial<Transaction> = {
    id: 'tx-uuid-3333',
    walletId: mockWallet.id,
    amount: '500.0000',
    type: TransactionType.TRANSFER_OUT,
    status: TransactionStatus.COMPLETED,
    reference: 'ref-uuid-4444',
    createdAt: new Date('2026-09-01T12:00:00Z'),
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockTransaction], 25]),
    };

    mockTransactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
    };

    mockWalletService = {
      getWalletByUserId: jest.fn().mockResolvedValue(mockWallet),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    }).compile();

    transactionsService = module.get<TransactionsService>(TransactionsService);
  });

  describe('getTransactions()', () => {
    it('should calculate pagination metadata accurately and use composite index order', async () => {
      const result = await transactionsService.getTransactions(mockUser.id, {
        page: 1,
        limit: 10,
      });

      expect(mockWalletService.getWalletByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(mockTransactionRepository.createQueryBuilder).toHaveBeenCalledWith('tx');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('tx.wallet_id = :walletId', {
        walletId: mockWallet.id,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('tx.createdAt', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('should clamp limit to maximum 100 items per page', async () => {
      await transactionsService.getTransactions(mockUser.id, {
        page: 1,
        limit: 500,
      });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should apply type filter when provided', async () => {
      await transactionsService.getTransactions(mockUser.id, {
        type: TransactionType.TRANSFER_OUT,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('tx.type = :type', {
        type: TransactionType.TRANSFER_OUT,
      });
    });

    it('should apply status filter when provided', async () => {
      await transactionsService.getTransactions(mockUser.id, {
        status: TransactionStatus.COMPLETED,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('tx.status = :status', {
        status: TransactionStatus.COMPLETED,
      });
    });

    it('should apply date range filters when provided', async () => {
      await transactionsService.getTransactions(mockUser.id, {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :startDate',
        expect.objectContaining({ startDate: expect.any(Date) }),
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :endDate',
        expect.objectContaining({ endDate: expect.any(Date) }),
      );
    });
  });

  describe('getTransactionById()', () => {
    it('should return transaction when found for authenticated user wallet', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await transactionsService.getTransactionById(
        mockUser.id,
        mockTransaction.id!,
      );

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockTransaction.id,
          walletId: mockWallet.id,
        },
      });
    });

    it('should throw NotFoundException if transaction does not exist or belongs to another user (IDOR defense)', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(null);

      await expect(
        transactionsService.getTransactionById(mockUser.id, 'foreign-tx-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
