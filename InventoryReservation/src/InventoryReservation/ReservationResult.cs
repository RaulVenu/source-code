namespace InventoryReservation;

public enum ReservationStatus
{
    Success,
    InvalidInput,
    InsufficientStock,
    ProductNotFound,
    IdempotencyConflict
}

public sealed record ReservationResult(
    ReservationStatus Status,
    string Message,
    string? Sku = null,
    int Quantity = 0)
{
    public bool IsSuccess => Status == ReservationStatus.Success;
}