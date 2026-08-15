import { ApiError } from './api_error'

export class BarcodeConflictError extends ApiError {
  constructor(barcode: string) {
    super(409, 'BARCODE_CONFLICT', 'Barcode already exists for this business', { barcode })
    this.name = 'BarcodeConflictError'
  }
}
