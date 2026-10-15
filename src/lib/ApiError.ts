export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'API_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequestError = (message = 'Bad request', details?: unknown) =>
  new ApiError(400, message, 'BAD_REQUEST', details);
export const unauthorizedError = (message = 'Unauthorized') => new ApiError(401, message, 'UNAUTHORIZED');
export const forbiddenError = (message = 'Forbidden') => new ApiError(403, message, 'FORBIDDEN');
export const notFoundError = (message = 'Not found') => new ApiError(404, message, 'NOT_FOUND');
export const conflictError = (message = 'Conflict') => new ApiError(409, message, 'CONFLICT');
