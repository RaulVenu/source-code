using Microsoft.Data.Sqlite;
using Xunit;

namespace InventoryReservation.Tests;

public sealed class InventoryReservationServiceTests : IDisposable
{
    private readonly string _databasePath =
        Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.db");

    private SqliteConnection CreateConnection()
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = _databasePath,
            DefaultTimeout = 30
        };

        return new SqliteConnection(builder.ConnectionString);
    }

    private async Task<InventoryReservationService> CreateServiceAsync(
        int stock)
    {
        var service = new InventoryReservationService(CreateConnection);

        await service.InitializeAsync();

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Inventory (Sku, Quantity)
            VALUES ('SKU-001', $stock);
            """;
        command.Parameters.AddWithValue("$stock", stock);

        await command.ExecuteNonQueryAsync();

        return service;
    }

    private async Task<int> GetStockAsync()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT Quantity FROM Inventory WHERE Sku = 'SKU-001';
            """;

        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    [Fact]
    public async Task ConcurrentReservations_ShouldNotOversell()
    {
        var service = await CreateServiceAsync(stock: 5);

        var tasks = Enumerable.Range(0, 20)
            .Select(i => service.ReserveAsync(
                "SKU-001",
                1,
                $"key-{i}",
                CancellationToken.None));

        var results = await Task.WhenAll(tasks);

        Assert.Equal(
            5,
            results.Count(r => r.Status == ReservationStatus.Success));

        Assert.Equal(
            15,
            results.Count(r =>
                r.Status == ReservationStatus.InsufficientStock));

        Assert.Equal(0, await GetStockAsync());
    }

    [Fact]
    public async Task RepeatedIdempotencyKey_ShouldNotDecrementStockTwice()
    {
        var service = await CreateServiceAsync(stock: 10);

        var first = await service.ReserveAsync(
            "SKU-001", 3, "request-123", CancellationToken.None);

        var second = await service.ReserveAsync(
            "SKU-001", 3, "request-123", CancellationToken.None);

        Assert.Equal(ReservationStatus.Success, first.Status);
        Assert.Equal(first, second);
        Assert.Equal(7, await GetStockAsync());
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();

        if (File.Exists(_databasePath))
            File.Delete(_databasePath);
    }
}