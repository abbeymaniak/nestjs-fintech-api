import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class WithdrawDto {
  @ApiProperty({
    example: 10000,
    description: 'Amount in NGN to withdraw from the wallet (minimum 1 NGN)',
  })
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'Amount must be a valid number with up to 4 decimal places' },
  )
  @IsPositive({ message: 'Withdrawal amount must be greater than 0' })
  @Min(1, { message: 'Minimum withdrawal amount is 1 NGN' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Transfer to external bank account',
    description: 'Optional withdrawal note or destination description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
