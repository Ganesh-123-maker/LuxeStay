process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { stripeConfigured, createCheckoutSession } = require("../services/paymentService.js");
const { smtpConfigured, sendBookingConfirmation } = require("../services/emailService.js");

test("payment: without Stripe keys it reports unavailable, never fakes success", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(stripeConfigured(), false);
    const result = await createCheckoutSession(
        { _id: "booking1", nights: 2 },
        { price: 1000, title: "Test flat" },
        "http://localhost:3000"
    );
    assert.equal(result.available, false);
    assert.ok(result.reason);
});

test("email: without SMTP it reports not sent, never claims delivery", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    assert.equal(smtpConfigured(), false);
    const result = await sendBookingConfirmation({
        to: "guest@example.com",
        listingTitle: "Test flat",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
        guests: 2,
        total: 2360,
    });
    assert.equal(result.sent, false);
    assert.equal(result.reason, "SMTP_NOT_CONFIGURED");
});
