import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { FundWalletDto } from './dto/fund-wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
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
  ): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);

    const currentBalance = parseFloat(wallet.balance);
    const newBalance = (currentBalance + fundWalletDto.amount).toFixed(4);

    wallet.balance = newBalance;
    return await this.walletRepository.save(wallet);
  }
}
