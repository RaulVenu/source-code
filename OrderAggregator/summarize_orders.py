from collections import defaultdict


def summarize_orders(events):
    """Return order summaries after deduplicating and sorting events."""
    unique_events = {}

    for event in events:
        unique_events.setdefault(event["event_id"], event)

    orders = defaultdict(list)

    for event in unique_events.values():
        orders[event["order_id"]].append(event)

    summaries = []

    for order_id, order_events in orders.items():
        order_events.sort(
            key=lambda event: (event["timestamp"], event["event_id"])
        )

        status = "PENDING"
        items = defaultdict(int)

        for event in order_events:
            event_type = event["type"]

            if event_type == "CREATED":
                continue

            if status in ("PAID", "CANCELLED"):
                continue

            if event_type == "ITEM_ADDED":
                sku = event["sku"]
                qty = event["qty"]
                items[sku] += qty

            elif event_type == "ITEM_REMOVED":
                sku = event["sku"]
                qty = event["qty"]
                items[sku] = max(0, items[sku] - qty)

            elif event_type == "PAID":
                status = "PAID"

            elif event_type == "CANCELLED":
                status = "CANCELLED"

        summaries.append({
            "order_id": order_id,
            "status": status,
            "items": {
                sku: qty
                for sku, qty in sorted(items.items())
                if qty > 0
            },
        })

    return sorted(summaries, key=lambda summary: summary["order_id"])



