import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

export class GetTransactionsQueryDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    description: 'Page number for pagination (starts at 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 100,
    description: 'Number of transaction records to return per page (max: 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Filter by transaction type (DEPOSIT, TRANSFER_IN, TRANSFER_OUT, WITHDRAWAL)',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    description: 'Filter by transaction status (PENDING, COMPLETED, FAILED)',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Filter transactions created on or after this date (ISO 8601 or YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Filter transactions created on or before this date (ISO 8601 or YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
