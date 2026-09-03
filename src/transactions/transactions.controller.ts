import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { GetTransactionsQueryDto } from './dto/get-transactions-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve paginated transaction history with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated transactions list with metadata',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token',
  })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query() query: GetTransactionsQueryDto,
  ) {
    return await this.transactionsService.getTransactions(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve single transaction details by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Transaction UUID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found or belongs to another user',
  })
  async getTransactionById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.transactionsService.getTransactionById(userId, id);
  }
}
