import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'API Health Check and Smoke Test' })
  @ApiResponse({ status: 200, description: 'API service is online and healthy' })
  getHello(): string {
    return this.appService.getHello();
  }
}
