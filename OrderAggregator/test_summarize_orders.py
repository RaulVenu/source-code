import unittest

from summarize_orders import summarize_orders


class TestSummarizeOrders(unittest.TestCase):

    # Test that an empty event list returns an empty list.
    def test_empty_input(self):
        self.assertEqual(summarize_orders([]), [])

    # Test that duplicate events with the same event_id are processed only once.
    def test_deduplicates_events(self):
        events = [
            {"order_id": "A", "event_id": "e1",
             "type": "CREATED", "timestamp": 1},
            {"order_id": "A", "event_id": "e2",
             "type": "ITEM_ADDED", "sku": "P1",
             "qty": 2, "timestamp": 2},
            {"order_id": "A", "event_id": "e2",
             "type": "ITEM_ADDED", "sku": "P1",
             "qty": 2, "timestamp": 2},
        ]

        result = summarize_orders(events)

        # Quantity should be 2, not 4, because the duplicate is ignored.
        self.assertEqual(result[0]["items"], {"P1": 2})

    # Test that events are processed chronologically, even if received out of order.
    def test_events_are_processed_by_timestamp(self):
        events = [
            {"order_id": "A", "event_id": "e3",
             "type": "PAID", "timestamp": 3},
            {"order_id": "A", "event_id": "e1",
             "type": "CREATED", "timestamp": 1},
            {"order_id": "A", "event_id": "e2",
             "type": "ITEM_ADDED", "sku": "P1",
             "qty": 2, "timestamp": 2},
        ]

        result = summarize_orders(events)

        # The item is added before payment, so it must remain in the summary.
        self.assertEqual(
            result,
            [{"order_id": "A", "status": "PAID",
              "items": {"P1": 2}}]
        )

    # Test that event_id determines the order when timestamps are equal.
    def test_event_id_breaks_timestamp_ties(self):
        events = [
            {"order_id": "A", "event_id": "e2",
             "type": "PAID", "timestamp": 1},
            {"order_id": "A", "event_id": "e1",
             "type": "ITEM_ADDED", "sku": "P1",
             "qty": 2, "timestamp": 1},
        ]

        result = summarize_orders(events)

        # e1 sorts before e2, so the item is added before payment.
        self.assertEqual(result[0]["items"], {"P1": 2})
        self.assertEqual(result[0]["status"], "PAID")

    # Test that removing more items than available never creates a negative quantity.
    def test_removal_never_makes_quantity_negative(self):
        events = [
            {"order_id": "A", "event_id": "e1",
             "type": "ITEM_REMOVED", "sku": "P1",
             "qty": 5, "timestamp": 1},
        ]

        result = summarize_orders(events)

        # No items should remain because the quantity cannot be negative.
        self.assertEqual(result[0]["items"], {})

    # Test that item additions after payment are ignored.
    def test_item_changes_after_paid_are_ignored(self):
        events = [
            {"order_id": "A", "event_id": "e1",
             "type": "ITEM_ADDED", "sku": "P1",
             "qty": 2, "timestamp": 1},
            {"order_id": "A", "event_id": "e2",
             "type": "PAID", "timestamp": 2},
            {"order_id": "A", "event_id": "e3",
             "type": "ITEM_ADDED", "sku": "P2",
             "qty": 3, "timestamp": 3},
        ]

        result = summarize_orders(events)

        # P1 remains, but P2 is ignored because the order is already paid.
        self.assertEqual(result[0]["items"], {"P1": 2})
        self.assertEqual(result[0]["status"], "PAID")

    # Test that a PAID event cannot change an already cancelled order.
    def test_paid_after_cancelled_is_ignored(self):
        events = [
            {"order_id": "A", "event_id": "e1",
             "type": "CANCELLED", "timestamp": 1},
            {"order_id": "A", "event_id": "e2",
             "type": "PAID", "timestamp": 2},
        ]

        result = summarize_orders(events)

        # The order must remain cancelled.
        self.assertEqual(result[0]["status"], "CANCELLED")

    # Test that item modifications after cancellation are ignored.
    def test_item_changes_after_cancelled_are_ignored(self):
        events = [
            {"order_id": "A", "event_id": "e1",
             "type": "ITEM_ADDED", "sku": "P1",
             "qty": 2, "timestamp": 1},
            {"order_id": "A", "event_id": "e2",
             "type": "CANCELLED", "timestamp": 2},
            {"order_id": "A", "event_id": "e3",
             "type": "ITEM_ADDED", "sku": "P2",
             "qty": 3, "timestamp": 3},
        ]

        result = summarize_orders(events)

        # P1 remains in the summary, but P2 is not added after cancellation.
        self.assertEqual(result[0]["items"], {"P1": 2})
        self.assertEqual(result[0]["status"], "CANCELLED")

    # Test that multiple order summaries are returned in ascending order_id order.
    def test_orders_are_sorted_by_id(self):
        events = [
            {"order_id": "B", "event_id": "e1",
             "type": "CREATED", "timestamp": 1},
            {"order_id": "A", "event_id": "e2",
             "type": "CREATED", "timestamp": 1},
        ]

        result = summarize_orders(events)

        # Order A must appear before order B.
        self.assertEqual(
            [order["order_id"] for order in result],
            ["A", "B"]
        )


if __name__ == "__main__":
    # Run all unit tests when this file is executed directly.
    unittest.main()