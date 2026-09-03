import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HttpExceptionFilter
 *
 * WHAT IT DOES:
 * Intercepts all unhandled `HttpException` instances thrown anywhere in the application
 * (by guards, pipes, controllers, or services) and transforms them into a unified,
 * predictable JSON error response.
 *
 * WHY WE USE IT (Interview Talking Point — Uniform Error Envelopes):
 * In client-facing fintech APIs, consistent error formatting is vital for several reasons:
 *
 * 1. API Predictability: Frontend clients (mobile apps, web dashboards) must always be able to
 *    parse errors using a single response contract without guessing whether the server returned
 *    a raw string, HTML, or varying JSON shapes.
 *
 * 2. Information Sanitization: By controlling error formatting centrally, we ensure internal
 *    database errors, stack traces, or server internals are never leaked to external clients.
 *
 * 3. Validation Pipe Compatibility: NestJS `ValidationPipe` (class-validator) throws 400 Bad Request
 *    with an array of validation failure strings (e.g. ["email must be an email"]). This filter
 *    cleanly unwraps both single-message errors and validation error arrays.
 *
 * 4. Centralized Observability: Logs every client error (4xx) and server error (5xx) with the
 *    HTTP method, route, and status code for monitoring and debugging.
 *
 * LIFECYCLE IN NESTJS:
 * Exception filters sit at the outermost layer of the NestJS execution pipeline.
 * They are the final line of defense before a response is sent to the client.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // 1. Extract error details, handling both string and object responses
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
      // class-validator errors return { message: string[], error: string }
      errorMessage = responseObj.message || exception.message;
      errorType = responseObj.error || exception.name;
    } else {
      errorMessage = exception.message;
      errorType = HttpStatus[status] || 'Error';
    }

    // 2. Structured JSON response payload sent to client
    const errorBody = {
      statusCode: status,
      error: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 3. Log errors: Warn for client errors (4xx), Error for server errors (5xx)
    const logMessage = `[${request.method}] ${request.url} - Status: ${status} - Error: ${JSON.stringify(errorMessage)}`;
    if (status >= 500) {
      this.logger.error(logMessage, exception.stack);
    } else {
      this.logger.warn(logMessage);
    }

    // 4. Send standardized response
    response.status(status).json(errorBody);
  }
}
