import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), WalletModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TypeOrmModule, TransactionsService],
})
export class TransactionsModule {}

