import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransfersService } from './transfers.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { UserRole } from '../users/entities/user.entity';

describe('TransfersService (Unit Tests)', () => {
  let transfersService: TransfersService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let walletService: jest.Mocked<Partial<WalletService>>;
  let dataSource: any;
  let mockQueryRunner: any;

  const mockSenderUser = {
    id: 'sender-uuid-1111',
    email: 'sender@fintech.com',
    role: UserRole.USER,
    isActive: true,
  };

  const mockRecipientUser = {
    id: 'recipient-uuid-2222',
    email: 'recipient@fintech.com',
    role: UserRole.USER,
    isActive: true,
  };

  const mockSenderWallet = {
    id: 'wallet-sender-1111',
    userId: mockSenderUser.id,
    balance: '1000.0000',
    currency: 'NGN',
  };

  const mockRecipientWallet = {
    id: 'wallet-recipient-2222',
    userId: mockRecipientUser.id,
    balance: '200.0000',
    currency: 'NGN',
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
    };

    walletService = {
      getWalletByUserId: jest.fn(),
    };

    const mockQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockSenderWallet),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((entity, dto) => dto),
        save: jest.fn().mockImplementation((entities) => Promise.resolve(entities)),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: UsersService, useValue: usersService },
        { provide: WalletService, useValue: walletService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    transfersService = module.get<TransfersService>(TransfersService);
  });

  describe('sendTransfer()', () => {
    it('should successfully execute transfer with double-entry ledger and atomic commit', async () => {
      usersService.findByEmail!.mockResolvedValue(mockRecipientUser as any);
      walletService.getWalletByUserId!
        .mockResolvedValueOnce(mockSenderWallet as any)
        .mockResolvedValueOnce(mockRecipientWallet as any);

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockSenderWallet, balance: '1000.0000' })
        .mockResolvedValueOnce({ ...mockRecipientWallet, balance: '200.0000' });

      const result = await transfersService.sendTransfer(mockSenderUser.id, {
        recipientEmail: 'recipient@fintech.com',
        amount: 300,
        description: 'Lunch money',
      });

      expect(result).toHaveProperty('reference');
      expect(result.amount).toBe(300);
      expect(result.senderBalance).toBe('700.0000');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if recipient email does not exist', async () => {
      usersService.findByEmail!.mockResolvedValue(null);

      await expect(
        transfersService.sendTransfer(mockSenderUser.id, {
          recipientEmail: 'unknown@fintech.com',
          amount: 100,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if recipient is deactivated', async () => {
      usersService.findByEmail!.mockResolvedValue({
        ...mockRecipientUser,
        isActive: false,
      } as any);

      await expect(
        transfersService.sendTransfer(mockSenderUser.id, {
          recipientEmail: 'recipient@fintech.com',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user attempts self-transfer', async () => {
      usersService.findByEmail!.mockResolvedValue({
        ...mockSenderUser,
      } as any);

      await expect(
        transfersService.sendTransfer(mockSenderUser.id, {
          recipientEmail: 'sender@fintech.com',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback transaction and throw BadRequestException on insufficient balance', async () => {
      usersService.findByEmail!.mockResolvedValue(mockRecipientUser as any);
      walletService.getWalletByUserId!
        .mockResolvedValueOnce(mockSenderWallet as any)
        .mockResolvedValueOnce(mockRecipientWallet as any);

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockSenderWallet, balance: '50.0000' })
        .mockResolvedValueOnce({ ...mockRecipientWallet, balance: '200.0000' });

      await expect(
        transfersService.sendTransfer(mockSenderUser.id, {
          recipientEmail: 'recipient@fintech.com',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback transaction if an unexpected database error occurs during save', async () => {
      usersService.findByEmail!.mockResolvedValue(mockRecipientUser as any);
      walletService.getWalletByUserId!
        .mockResolvedValueOnce(mockSenderWallet as any)
        .mockResolvedValueOnce(mockRecipientWallet as any);

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockSenderWallet, balance: '1000.0000' })
        .mockResolvedValueOnce({ ...mockRecipientWallet, balance: '200.0000' });

      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('PostgreSQL deadlock simulated'));

      await expect(
        transfersService.sendTransfer(mockSenderUser.id, {
          recipientEmail: 'recipient@fintech.com',
          amount: 100,
        }),
      ).rejects.toThrow('PostgreSQL deadlock simulated');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('withdraw()', () => {
    it('should successfully withdraw funds and update balance', async () => {
      walletService.getWalletByUserId!.mockResolvedValue(mockSenderWallet as any);

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockSenderWallet, balance: '500.0000' }),
      });

      const result = await transfersService.withdraw(mockSenderUser.id, {
        amount: 200,
      });

      expect(result.remainingBalance).toBe('300.0000');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException and rollback if withdrawal exceeds balance', async () => {
      walletService.getWalletByUserId!.mockResolvedValue(mockSenderWallet as any);

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockSenderWallet, balance: '50.0000' }),
      });

      await expect(
        transfersService.withdraw(mockSenderUser.id, {
          amount: 200,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });
});
