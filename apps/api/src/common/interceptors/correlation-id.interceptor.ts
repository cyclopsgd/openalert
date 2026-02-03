import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Correlation ID Interceptor
 * Adds correlation IDs to requests for distributed tracing
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    // Get or generate correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Attach to request for downstream use
    (request as any).correlationId = correlationId;

    // Add to response headers
    return next.handle().pipe(
      tap(() => {
        response.header('X-Correlation-ID', correlationId);
      }),
    );
  }
}
