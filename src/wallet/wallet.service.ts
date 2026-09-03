import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Wallet } from './entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { FundWalletDto } from './dto/fund-wallet.dto';

export interface FundWalletResult {
  id: string;
  userId: string;
  balance: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  transaction: Transaction;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async createWalletForUser(
    userId: string,
    currency: string = 'NGN',
    manager?: EntityManager,
  ): Promise<Wallet> {
    const repo = manager
      ? manager.getRepository(Wallet)
      : this.walletRepository;

    const wallet = repo.create({
      userId,
      balance: '0.0000',
      currency,
    });

    return await repo.save(wallet);
  }

  async getWalletByUserId(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.createWalletForUser(userId, 'NGN');
    }

    return wallet;
  }

  async fundWallet(
    userId: string,
    fundWalletDto: FundWalletDto,
  ): Promise<FundWalletResult> {
    const userWallet = await this.getWalletByUserId(userId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedWallet = await queryRunner.manager
        .createQueryBuilder(Wallet, 'wallet')
        .setLock('pessimistic_write')
        .where('wallet.id = :id', { id: userWallet.id })
        .getOne();

      if (!lockedWallet) {
        throw new NotFoundException('Wallet not found');
      }

      const currentBalance = parseFloat(lockedWallet.balance);
      const newBalance = (currentBalance + fundWalletDto.amount).toFixed(4);
      lockedWallet.balance = newBalance;

      const savedWallet = await queryRunner.manager.save(lockedWallet);

      const depositLedger = queryRunner.manager.create(Transaction, {
        walletId: lockedWallet.id,
        senderId: userId,
        amount: fundWalletDto.amount.toFixed(4),
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        reference: randomUUID(),
        description: fundWalletDto.description || 'Wallet funding / deposit',
        metadata: {
          senderId: userId,
          receiverId: userId,
          source: 'EXTERNAL_FUNDING',
          description: fundWalletDto.description || 'Wallet funding / deposit',
        },
      });

      const savedTransaction = await queryRunner.manager.save(depositLedger);

      await queryRunner.commitTransaction();

      return {
        ...savedWallet,
        transaction: savedTransaction,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
