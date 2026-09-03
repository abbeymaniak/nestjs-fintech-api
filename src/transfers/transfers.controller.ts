import {
  Body,
  Controller,
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
import { TransfersService } from './transfers.service';
import { SendTransferDto } from './dto/send-transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Transfers')
@ApiBearerAuth('JWT-auth')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer funds atomically to another registered user' })
  @ApiResponse({
    status: 200,
    description: 'Transfer executed successfully with audit reference',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance, self-transfer, or invalid parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token',
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient user not found',
  })
  async sendTransfer(
    @CurrentUser('id') senderUserId: string,
    @Body() sendTransferDto: SendTransferDto,
  ) {
    return await this.transfersService.sendTransfer(senderUserId, sendTransferDto);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw funds from the authenticated user wallet' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal executed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or invalid amount',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token',
  })
  async withdraw(
    @CurrentUser('id') userId: string,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return await this.transfersService.withdraw(userId, withdrawDto);
  }
}
