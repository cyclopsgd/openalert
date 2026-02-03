import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Global Exception Filter
 * Catches all unhandled exceptions and provides consistent error responses
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    // Determine HTTP status code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Generate correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Extract error message
    let message = 'Internal server error';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        message = (response as any).message || message;
        errors = (response as any).message instanceof Array ? (response as any).message : undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Check for database-specific errors
    if (this.isDatabaseError(exception)) {
      const dbError = this.handleDatabaseError(exception as any);
      message = dbError.message;
      errors = dbError.errors;
    }

    const errorResponse = {
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
    };

    // Log error with full stack trace for 500 errors
    if (status >= 500) {
      this.logger.error(
        `Unhandled Exception: ${message}`,
        {
          path: request.url,
          method: request.method,
          correlationId,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
      );
    } else {
      this.logger.warn(
        `Client Error ${status}: ${message}`,
        {
          path: request.url,
          correlationId,
        },
      );
    }

    response.status(status).send(errorResponse);
  }

  /**
   * Check if error is a database error
   */
  private isDatabaseError(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;

    const errorCode = (exception as any).code;
    return (
      errorCode === '23505' || // Unique violation
      errorCode === '23503' || // Foreign key violation
      errorCode === '23502' || // Not null violation
      errorCode === '22P02' || // Invalid text representation
      errorCode === '42P01'    // Undefined table
    );
  }

  /**
   * Handle database-specific errors
   */
  private handleDatabaseError(exception: any): { message: string; errors?: string[] } {
    const errorCode = exception.code;

    switch (errorCode) {
      case '23505': // Unique violation
        return {
          message: 'A record with this value already exists',
          errors: [exception.detail || 'Duplicate key violation'],
        };

      case '23503': // Foreign key violation
        return {
          message: 'Referenced record does not exist',
          errors: [exception.detail || 'Foreign key constraint violation'],
        };

      case '23502': // Not null violation
        return {
          message: 'Required field is missing',
          errors: [exception.detail || 'Not null violation'],
        };

      case '22P02': // Invalid text representation
        return {
          message: 'Invalid data format',
          errors: ['Invalid data type provided'],
        };

      case '42P01': // Undefined table
        return {
          message: 'Database schema error',
          errors: ['Table does not exist'],
        };

      default:
        return {
          message: 'Database error occurred',
          errors: [exception.message],
        };
    }
  }
}
