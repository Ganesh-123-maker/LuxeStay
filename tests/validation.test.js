process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { listingSchema, reviewSchema, bookingSchema } = require("../schema.js");
const { canManageListing, canDeleteReview, isAdmin } = require("../services/authorization.js");

test("listing validation: rejects negative price and missing title", () => {
    const bad = listingSchema.validate({
        listing: { title: "", description: "x", location: "Jaipur", country: "India", price: -5 },
    });
    assert.ok(bad.error);
    const good = listingSchema.validate({
        listing: {
            title: "Cozy flat",
            description: "Nice",
            location: "Jaipur",
            country: "India",
            price: 1200,
            category: "City",
            amenities: ["Wifi"],
            guests: 4,
        },
    });
    assert.equal(good.error, undefined);
});

test("review validation: rating must be 1-5 and bookingId is required", () => {
    assert.ok(reviewSchema.validate({ review: { rating: 6, comment: "x", bookingId: "abc" } }).error);
    assert.ok(reviewSchema.validate({ review: { rating: 5, comment: "x" } }).error);
    assert.equal(
        reviewSchema.validate({ review: { rating: 5, comment: "Great", bookingId: "abc" } }).error,
        undefined
    );
});

test("booking validation: requires dates and guests >= 1", () => {
    assert.ok(bookingSchema.validate({ booking: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 0 } }).error);
    assert.equal(
        bookingSchema.validate({ booking: { checkIn: "2026-03-01", checkOut: "2026-03-03", guests: 2 } }).error,
        undefined
    );
});

test("authorization: owner and admin can manage, strangers cannot; null-safe", () => {
    const owner = { _id: "1", role: "guest" };
    const stranger = { _id: "2", role: "guest" };
    const admin = { _id: "3", role: "admin" };
    const listing = { owner: "1" };
    assert.equal(canManageListing(owner, listing), true);
    assert.equal(canManageListing(stranger, listing), false);
    assert.equal(canManageListing(admin, listing), true);
    assert.equal(canManageListing(null, listing), false);
    assert.equal(canManageListing(owner, null), false);
    assert.equal(canDeleteReview(stranger, { author: "1" }), false);
    assert.equal(canDeleteReview(owner, { author: "1" }), true);
    assert.equal(isAdmin(admin), true);
    assert.equal(isAdmin(owner), false);
    assert.equal(isAdmin(null), false);
});
