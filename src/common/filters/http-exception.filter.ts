import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let errorMessage: string | string[];
    let errorType: string;

    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
      errorType = exception.name;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as Record<string, any>;
      errorMessage = responseObj.message || exception.message;
      errorType = responseObj.error || exception.name;
    } else {
      errorMessage = exception.message;
      errorType = HttpStatus[status] || 'Error';
    }

    const errorBody = {
      statusCode: status,
      error: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const logMessage = `[${request.method}] ${request.url} - Status: ${status} - Error: ${JSON.stringify(errorMessage)}`;
    if (status >= 500) {
      this.logger.error(logMessage, exception.stack);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(status).json(errorBody);
  }
}
