import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Global HTTP Exception Filter
 * Provides consistent error response format across the application
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const error =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, any>);

    // Generate or retrieve correlation ID for request tracking
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const errorResponse = {
      statusCode: status,
      message: error.message || 'An error occurred',
      errors: error.message instanceof Array ? error.message : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
    };

    // Log error with context
    this.logger.error(`HTTP ${status} Error: ${errorResponse.message}`, {
      path: request.url,
      method: request.method,
      correlationId,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      errors: errorResponse.errors,
    });

    response.status(status).send(errorResponse);
  }
}
