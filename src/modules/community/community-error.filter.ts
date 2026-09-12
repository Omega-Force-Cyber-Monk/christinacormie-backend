import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class CommunityErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(CommunityErrorFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (status === 413)
        return response.status(status).json({
          statusCode: status,
          error: 'Payload Too Large',
          message: 'Each attachment must be 10 MB or smaller',
        });
      if (
        exception.message === 'Too many files' ||
        exception.message.startsWith('Unexpected field')
      )
        return response.status(400).json({
          statusCode: 400,
          error: 'Bad Request',
          message:
            'Upload at most 5 files using the multipart field named files',
        });
      return response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
    }
    this.logger.error(
      'Community operation failed',
      exception instanceof Error ? exception.stack : undefined,
    );
    return response.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message:
        'Unable to complete the Community request. Please try again or contact support',
    });
  }
}
