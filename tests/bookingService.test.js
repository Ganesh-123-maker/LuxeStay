process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
    calculateNights,
    calculateTotal,
    overlaps,
    isAvailable,
    validateBookingInput,
} = require("../services/bookingService.js");

test("nights: checkout-exclusive, same-day turnover is not a night", () => {
    assert.equal(calculateNights("2026-03-01", "2026-03-04"), 3);
    assert.equal(calculateNights("2026-03-04", "2026-03-04"), 0);
    assert.equal(calculateNights("not-a-date", "2026-03-04"), 0);
});

test("price: base + 18% GST, rounded", () => {
    const t = calculateTotal(1000, "2026-03-01", "2026-03-03");
    assert.deepEqual(t, { nights: 2, base: 2000, gst: 360, total: 2360 });
    // 999 * 1 = 999, GST rounds 179.82 -> 180
    assert.equal(calculateTotal(999, "2026-03-01", "2026-03-02").total, 1179);
});

test("overlap: interior overlap blocks, abutting dates do not", () => {
    assert.equal(overlaps("2026-03-01", "2026-03-05", "2026-03-04", "2026-03-08"), true);
    assert.equal(overlaps("2026-03-01", "2026-03-05", "2026-03-05", "2026-03-08"), false);
    assert.equal(overlaps("2026-03-05", "2026-03-08", "2026-03-01", "2026-03-05"), false);
    assert.equal(overlaps("2026-03-02", "2026-03-03", "2026-03-01", "2026-03-08"), true);
});

test("availability: cancelled bookings do not block, pending/confirmed do", () => {
    const existing = [
        { status: "cancelled", checkIn: "2026-03-02", checkOut: "2026-03-06" },
        { status: "pending", checkIn: "2026-03-10", checkOut: "2026-03-12" },
    ];
    assert.equal(isAvailable(existing, "2026-03-03", "2026-03-05"), true);
    assert.equal(isAvailable(existing, "2026-03-11", "2026-03-13"), false);
});

test("booking input validation catches bad dates, guests, capacity", () => {
    assert.ok(validateBookingInput({ checkIn: "2026-03-05", checkOut: "2026-03-03", guests: 2 }).length > 0);
    assert.ok(validateBookingInput({ checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 0 }).length > 0);
    assert.ok(validateBookingInput({ checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 9, maxGuests: 4 }).length > 0);
    assert.deepEqual(
        validateBookingInput({ checkIn: "2099-03-01", checkOut: "2099-03-03", guests: 2, maxGuests: 4 }),
        []
    );
});
