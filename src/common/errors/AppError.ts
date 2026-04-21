export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(404, `${resource} not found: ${id}`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class DuplicatePaymentError extends AppError {
  constructor(orderNumber: string) {
    super(409, `Duplicate payment for order: ${orderNumber}`, 'DUPLICATE_PAYMENT');
  }
}
