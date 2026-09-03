import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * RegisterDto
 *
 * WHAT IT DOES:
 * Defines and validates the payload structure required for user registration.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. Strong Typing & Validation (class-validator):
 *    NestJS DTOs (Data Transfer Objects) combined with the global `ValidationPipe`
 *    enforce that requests are validated *before* reaching controller logic.
 *    Any invalid payload is rejected with a 400 Bad Request error.
 *
 * 2. Password Complexity Enforcement:
 *    Fintech applications handle monetary assets, so passwords require at least
 *    8 characters containing uppercase, lowercase, and a digit/special character.
 *
 * 3. Swagger Integration (@ApiProperty):
 *    Every property is decorated with Swagger metadata so our interactive OpenAPI
 *    documentation at `/api/docs` automatically renders sample payloads, types,
 *    and required/optional constraints for frontend developers.
 */
export class RegisterDto {
  @ApiProperty({
    example: 'alex.morgan@fintech.com',
    description: 'Unique user email address (used for login)',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'Str0ngP@ssword!',
    description:
      'Password (min 8 chars, must contain uppercase, lowercase, and a number or special char)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  password: string;

  @ApiPropertyOptional({
    example: 'Alex',
    description: "User's first name",
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Morgan',
    description: "User's last name",
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    example: '+1-555-0199',
    description: "User's primary phone number",
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
