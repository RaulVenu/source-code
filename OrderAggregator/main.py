from summarize_orders import summarize_orders

events = [
    {
        "order_id": "A",
        "event_id": "e2",
        "type": "ITEM_ADDED",
        "sku": "P1",
        "qty": 2,
        "timestamp": 2,
    },
    {
        "order_id": "A",
        "event_id": "e1",
        "type": "CREATED",
        "timestamp": 1,
    },
    {
        "order_id": "A",
        "event_id": "e3",
        "type": "PAID",
        "timestamp": 3,
    },
]

result = summarize_orders(events)
print(result)