import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class SendTransferDto {
  @ApiProperty({
    example: 'chidi@fintech.com',
    description: 'Registered email address of the recipient',
  })
  @IsEmail({}, { message: 'Recipient email must be a valid email address' })
  @IsNotEmpty({ message: 'Recipient email is required' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  recipientEmail: string;

  @ApiProperty({
    example: 5000,
    description: 'Amount in NGN to transfer (minimum 1 NGN)',
  })
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'Amount must be a valid number with up to 4 decimal places' },
  )
  @IsPositive({ message: 'Transfer amount must be greater than 0' })
  @Min(1, { message: 'Minimum transfer amount is 1 NGN' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Dinner split',
    description: 'Optional transfer note or memo',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
