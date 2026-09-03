import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * LoginDto
 *
 * WHAT IT DOES:
 * Validates the credentials payload submitted during user authentication.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Point):
 * Even though password complexity is enforced at registration, during login we only
 * validate that the password is a non-empty string.
 * This prevents leaking internal password complexity rules through login error messages
 * and avoids rejecting valid users if complexity rules were updated over time.
 */
export class LoginDto {
  @ApiProperty({
    example: 'alex.morgan@fintech.com',
    description: 'Registered user email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'Str0ngP@ssword!',
    description: 'Account password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
