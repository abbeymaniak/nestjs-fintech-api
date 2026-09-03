import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: "Retrieve authenticated user's wallet balance" })
  @ApiResponse({
    status: 200,
    description: 'Wallet details and balance successfully retrieved',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  async getBalance(@CurrentUser('id') userId: string) {
    return await this.walletService.getWalletByUserId(userId);
  }

  @Post('fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit funds into the authenticated user wallet' })
  @ApiResponse({
    status: 200,
    description: 'Wallet successfully funded',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid amount or validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  async fund(
    @CurrentUser('id') userId: string,
    @Body() fundWalletDto: FundWalletDto,
  ) {
    return await this.walletService.fundWallet(userId, fundWalletDto);
  }
}
