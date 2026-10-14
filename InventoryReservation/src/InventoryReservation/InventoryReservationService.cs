using Microsoft.Data.Sqlite;

namespace InventoryReservation;

public sealed class InventoryReservationService
{
    private readonly Func<SqliteConnection> _connectionFactory;

    public InventoryReservationService(
        Func<SqliteConnection> connectionFactory)
    {
        _connectionFactory = connectionFactory
            ?? throw new ArgumentNullException(nameof(connectionFactory));
    }

    public async Task InitializeAsync(
        CancellationToken ct = default)
    {
        await using var connection = _connectionFactory();
        await connection.OpenAsync(ct);

        var sql = """
            CREATE TABLE IF NOT EXISTS Inventory (
                Sku TEXT PRIMARY KEY,
                Quantity INTEGER NOT NULL CHECK (Quantity >= 0)
            );

            CREATE TABLE IF NOT EXISTS Reservations (
                IdempotencyKey TEXT PRIMARY KEY,
                Sku TEXT NOT NULL,
                Quantity INTEGER NOT NULL,
                Status TEXT NOT NULL,
                Message TEXT NOT NULL
            );
            """;

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<ReservationResult> ReserveAsync(
        string sku,
        int quantity,
        string idempotencyKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(sku) ||
            string.IsNullOrWhiteSpace(idempotencyKey) ||
            quantity <= 0)
        {
            return new ReservationResult(
                ReservationStatus.InvalidInput,
                "SKU, idempotency key and positive quantity are required.",
                sku,
                quantity);
        }

        sku = sku.Trim();
        idempotencyKey = idempotencyKey.Trim();

        ct.ThrowIfCancellationRequested();

        await using var connection = _connectionFactory();
        await connection.OpenAsync(ct);

        // Acquire the SQLite write lock before reading or changing stock.
        // Concurrent writers must wait for the active transaction.
        using var transaction = connection.BeginTransaction(
            deferred: false);

        try
        {
            // Return the original outcome for a previously used key.
            var existing = await GetExistingAsync(
                connection, transaction, idempotencyKey, ct);

            if (existing is not null)
            {
                transaction.Commit();
                ct.ThrowIfCancellationRequested();

                if (existing.Sku != sku ||
                    existing.Quantity != quantity)
                {
                    return new ReservationResult(
                        ReservationStatus.IdempotencyConflict,
                        "Idempotency key was already used for another request.",
                        sku,
                        quantity);
                }

                return existing;
            }

            // Conditional decrement prevents stock from becoming negative.
            await using var update = connection.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = """
                UPDATE Inventory
                SET Quantity = Quantity - $quantity
                WHERE Sku = $sku
                  AND Quantity >= $quantity;
                """;

            update.Parameters.AddWithValue("$sku", sku);
            update.Parameters.AddWithValue("$quantity", quantity);

            var rowsAffected = await update.ExecuteNonQueryAsync(ct);

            ReservationResult result;

            if (rowsAffected == 1)
            {
                result = new ReservationResult(
                    ReservationStatus.Success,
                    "Inventory reserved successfully.",
                    sku,
                    quantity);
            }
            else
            {
                var exists = await ProductExistsAsync(
                    connection, transaction, sku, ct);

                result = exists
                    ? new ReservationResult(
                        ReservationStatus.InsufficientStock,
                        "Insufficient stock.",
                        sku,
                        quantity)
                    : new ReservationResult(
                        ReservationStatus.ProductNotFound,
                        "Product was not found.",
                        sku,
                        quantity);
            }

            // Persist the outcome and stock change in the same transaction.
            await using var insert = connection.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = """
                INSERT INTO Reservations
                    (IdempotencyKey, Sku, Quantity, Status, Message)
                VALUES
                    ($key, $sku, $quantity, $status, $message);
                """;

            insert.Parameters.AddWithValue("$key", idempotencyKey);
            insert.Parameters.AddWithValue("$sku", sku);
            insert.Parameters.AddWithValue("$quantity", quantity);
            insert.Parameters.AddWithValue("$status", result.Status.ToString());
            insert.Parameters.AddWithValue("$message", result.Message);

            await insert.ExecuteNonQueryAsync(ct);

            ct.ThrowIfCancellationRequested();
            transaction.Commit();

            return result;
        }
        catch
        {
            // Dispose/rollback ensures an uncommitted stock decrement
            // cannot survive a failed or cancelled operation.
            transaction.Rollback();
            throw;
        }
    }

    private static async Task<ReservationResult?> GetExistingAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string key,
        CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            SELECT Sku, Quantity, Status, Message
            FROM Reservations
            WHERE IdempotencyKey = $key;
            """;

        command.Parameters.AddWithValue("$key", key);

        await using var reader = await command.ExecuteReaderAsync(ct);

        if (!await reader.ReadAsync(ct))
            return null;

        return new ReservationResult(
            Enum.Parse<ReservationStatus>(reader.GetString(2)),
            reader.GetString(3),
            reader.GetString(0),
            reader.GetInt32(1));
    }

    private static async Task<bool> ProductExistsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string sku,
        CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            SELECT EXISTS (
                SELECT 1 FROM Inventory WHERE Sku = $sku
            );
            """;

        command.Parameters.AddWithValue("$sku", sku);

        return Convert.ToInt32(
            await command.ExecuteScalarAsync(ct)) == 1;
    }
}