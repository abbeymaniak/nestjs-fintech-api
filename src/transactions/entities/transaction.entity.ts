import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from '../../wallet/entities/wallet.entity';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('transactions')
@Index(['walletId', 'createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
  })
  amount: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', nullable: true })
  reference: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
