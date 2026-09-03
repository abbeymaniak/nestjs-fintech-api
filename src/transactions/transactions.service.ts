import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { WalletService } from '../wallet/wallet.service';
import { GetTransactionsQueryDto } from './dto/get-transactions-query.dto';

export interface PaginatedTransactionsResponse {
  data: Transaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly walletService: WalletService,
  ) {}

  async getTransactions(
    userId: string,
    query: GetTransactionsQueryDto,
  ): Promise<PaginatedTransactionsResponse> {
    const wallet = await this.walletService.getWalletByUserId(userId);

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.wallet_id = :walletId', { walletId: wallet.id });

    if (query.type) {
      queryBuilder.andWhere('tx.type = :type', { type: query.type });
    }

    if (query.status) {
      queryBuilder.andWhere('tx.status = :status', { status: query.status });
    }

    if (query.startDate) {
      queryBuilder.andWhere('tx.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      if (query.endDate.length <= 10) {
        end.setUTCHours(23, 59, 59, 999);
      }
      queryBuilder.andWhere('tx.createdAt <= :endDate', {
        endDate: end,
      });
    }

    queryBuilder
      .orderBy('tx.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getTransactionById(
    userId: string,
    transactionId: string,
  ): Promise<Transaction> {
    const wallet = await this.walletService.getWalletByUserId(userId);

    const transaction = await this.transactionRepository.findOne({
      where: {
        id: transactionId,
        walletId: wallet.id,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction record not found');
    }

    return transaction;
  }
}
