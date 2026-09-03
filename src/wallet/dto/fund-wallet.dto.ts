import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class FundWalletDto {
  @ApiProperty({
    example: 5000,
    description: 'Amount in NGN to deposit into the wallet (minimum 1 NGN)',
  })
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'Amount must be a valid number with up to 4 decimal places' },
  )
  @IsPositive({ message: 'Funding amount must be greater than 0' })
  @Min(1, { message: 'Minimum funding amount is 1 NGN' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Debit card top-up',
    description: 'Optional note or reference for the deposit',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
