import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { WalletService } from '../wallet/wallet.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: "Retrieve authenticated user's profile" })
  @ApiResponse({
    status: 200,
    description: 'Profile successfully retrieved',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  getProfile(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  @Get('wallet')
  @ApiOperation({ summary: "Retrieve authenticated user's current wallet balance" })
  @ApiResponse({
    status: 200,
    description: 'Wallet details and balance retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  async getWallet(@CurrentUser('id') userId: string) {
    return await this.walletService.getWalletByUserId(userId);
  }
}
