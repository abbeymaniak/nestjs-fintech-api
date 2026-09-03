import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { Wallet } from '../wallet/entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { SendTransferDto } from './dto/send-transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';

export interface TransferResult {
  reference: string;
  amount: number;
  currency: string;
  senderBalance: string;
  recipientEmail: string;
  status: TransactionStatus;
  createdAt: Date;
}

export interface WithdrawalResult {
  reference: string;
  amount: number;
  currency: string;
  remainingBalance: string;
  status: TransactionStatus;
  createdAt: Date;
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
  ) {}

  async sendTransfer(
    senderUserId: string,
    sendTransferDto: SendTransferDto,
  ): Promise<TransferResult> {
    const recipientEmail = sendTransferDto.recipientEmail.toLowerCase().trim();

    const recipient = await this.usersService.findByEmail(recipientEmail);
    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    if (!recipient.isActive) {
      throw new BadRequestException('Recipient account is deactivated');
    }

    if (senderUserId === recipient.id) {
      throw new BadRequestException('Cannot transfer funds to yourself');
    }

    const senderWallet = await this.walletService.getWalletByUserId(senderUserId);
    const recipientWallet = await this.walletService.getWalletByUserId(recipient.id);

    if (senderWallet.currency !== recipientWallet.currency) {
      throw new BadRequestException('Cross-currency transfers are not supported');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockOrder = [senderWallet.id, recipientWallet.id].sort();

      for (const walletId of lockOrder) {
        await queryRunner.manager
          .createQueryBuilder(Wallet, 'wallet')
          .setLock('pessimistic_write')
          .where('wallet.id = :id', { id: walletId })
          .getOne();
      }

      const lockedSenderWallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: senderWallet.id },
      });
      const lockedRecipientWallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: recipientWallet.id },
      });

      if (!lockedSenderWallet || !lockedRecipientWallet) {
        throw new NotFoundException('One or both wallets could not be located');
      }

      const currentSenderBalance = parseFloat(lockedSenderWallet.balance);
      const transferAmount = sendTransferDto.amount;

      if (currentSenderBalance < transferAmount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newSenderBalance = (currentSenderBalance - transferAmount).toFixed(4);
      const currentRecipientBalance = parseFloat(lockedRecipientWallet.balance);
      const newRecipientBalance = (currentRecipientBalance + transferAmount).toFixed(4);

      lockedSenderWallet.balance = newSenderBalance;
      lockedRecipientWallet.balance = newRecipientBalance;

      await queryRunner.manager.save([lockedSenderWallet, lockedRecipientWallet]);

      const transferReference = randomUUID();

      const debitLedger = queryRunner.manager.create(Transaction, {
        walletId: lockedSenderWallet.id,
        senderId: senderUserId,
        amount: transferAmount.toFixed(4),
        type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.COMPLETED,
        reference: transferReference,
        description: sendTransferDto.description || `Transfer to ${recipient.email}`,
        metadata: {
          senderId: senderUserId,
          receiverId: recipient.id,
          recipientEmail: recipient.email,
          description: sendTransferDto.description,
        },
      });

      const creditLedger = queryRunner.manager.create(Transaction, {
        walletId: lockedRecipientWallet.id,
        senderId: senderUserId,
        amount: transferAmount.toFixed(4),
        type: TransactionType.TRANSFER_IN,
        status: TransactionStatus.COMPLETED,
        reference: transferReference,
        description: sendTransferDto.description || `Transfer from sender`,
        metadata: {
          senderId: senderUserId,
          receiverId: recipient.id,
          description: sendTransferDto.description,
        },
      });

      await queryRunner.manager.save([debitLedger, creditLedger]);

      await queryRunner.commitTransaction();

      return {
        reference: transferReference,
        amount: transferAmount,
        currency: lockedSenderWallet.currency,
        senderBalance: newSenderBalance,
        recipientEmail: recipient.email,
        status: TransactionStatus.COMPLETED,
        createdAt: new Date(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async withdraw(
    userId: string,
    withdrawDto: WithdrawDto,
  ): Promise<WithdrawalResult> {
    const userWallet = await this.walletService.getWalletByUserId(userId);

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
      const withdrawAmount = withdrawDto.amount;

      if (currentBalance < withdrawAmount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newBalance = (currentBalance - withdrawAmount).toFixed(4);
      lockedWallet.balance = newBalance;
      await queryRunner.manager.save(lockedWallet);

      const withdrawalReference = randomUUID();

      const withdrawalLedger = queryRunner.manager.create(Transaction, {
        walletId: lockedWallet.id,
        senderId: userId,
        amount: withdrawAmount.toFixed(4),
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.COMPLETED,
        reference: withdrawalReference,
        description: withdrawDto.description || 'Wallet withdrawal',
        metadata: {
          senderId: userId,
          receiverId: null,
          destination: withdrawDto.description || 'Bank account',
          description: withdrawDto.description || 'Wallet withdrawal',
        },
      });

      await queryRunner.manager.save(withdrawalLedger);

      await queryRunner.commitTransaction();

      return {
        reference: withdrawalReference,
        amount: withdrawAmount,
        currency: lockedWallet.currency,
        remainingBalance: newBalance,
        status: TransactionStatus.COMPLETED,
        createdAt: new Date(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
