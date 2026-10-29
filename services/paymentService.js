// Stripe Checkout + webhook. Real integration, but it only runs when keys
// are present. Without keys it reports unavailable — it never fakes a payment.
function stripeConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
    if (!stripeConfigured()) return null;
    // Lazy require so `node --test` and key-less runs never need the SDK.
    return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

/** Create a Checkout session for an existing booking. Returns
 *  { available: false, reason } when Stripe is not configured. */
async function createCheckoutSession(booking, listing, baseUrl) {
    if (!stripeConfigured()) {
        return { available: false, reason: "STRIPE_SECRET_KEY is not set." };
    }
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${baseUrl}/trips?payment=success`,
        cancel_url: `${baseUrl}/trips?payment=cancelled`,
        metadata: { bookingId: booking._id.toString() },
        line_items: [
            {
                quantity: booking.nights,
                price_data: {
                    currency: "inr",
                    unit_amount: Math.round(listing.price * 100),
                    product_data: { name: listing.title },
                },
            },
        ],
    });
    return { available: true, url: session.url, sessionId: session.id };
}

/** Verify a webhook event. Returns { available: false } without keys/secret. */
function constructWebhookEvent(rawBody, signature) {
    if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
        return { available: false, reason: "Stripe webhook secret is not set." };
    }
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
    return { available: true, event };
}

module.exports = { stripeConfigured, createCheckoutSession, constructWebhookEvent };
