const GST_RATE = 0.18;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole nights between two dates (checkout exclusive). Returns 0 or less if invalid. */
function calculateNights(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.round((end - start) / DAY_MS);
}

/** { nights, base, gst, total } — total = price * nights + 18% GST. */
function calculateTotal(pricePerNight, checkIn, checkOut) {
    const nights = calculateNights(checkIn, checkOut);
    const base = pricePerNight * nights;
    const gst = Math.round(base * GST_RATE);
    return { nights, base, gst, total: base + gst };
}

/** Half-open overlap: [aStart, aEnd) overlaps [bStart, bEnd) iff aStart < bEnd && aEnd > bStart.
 *  Same-day turnover (one checkout = next check-in) is NOT an overlap. */
function overlaps(aStart, aEnd, bStart, bEnd) {
    return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

const BLOCKING_STATUSES = ["pending", "confirmed"];

/** Pure availability check against in-memory bookings (used by tests and controllers). */
function isAvailable(existingBookings, checkIn, checkOut) {
    return !existingBookings
        .filter((b) => BLOCKING_STATUSES.includes(b.status))
        .some((b) => overlaps(b.checkIn, b.checkOut, checkIn, checkOut));
}

/** MongoDB filter fragment for the same overlap rule — used by controllers. */
function overlapFilter(listingId, checkIn, checkOut) {
    return {
        listing: listingId,
        status: { $in: BLOCKING_STATUSES },
        checkIn: { $lt: new Date(checkOut) },
        checkOut: { $gt: new Date(checkIn) },
    };
}

function validateBookingInput({ checkIn, checkOut, guests, maxGuests }) {
    const errors = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        errors.push("Check-in and check-out dates are required.");
        return errors;
    }
    if (end <= start) errors.push("Check-out must be after check-in.");
    if (start < new Date(new Date().toDateString())) {
        errors.push("Check-in cannot be in the past.");
    }
    const n = Number(guests);
    if (!Number.isInteger(n) || n < 1) errors.push("Guests must be at least 1.");
    if (maxGuests && n > maxGuests) {
        errors.push(`This listing hosts at most ${maxGuests} guests.`);
    }
    return errors;
}

module.exports = {
    GST_RATE,
    calculateNights,
    calculateTotal,
    overlaps,
    isAvailable,
    overlapFilter,
    validateBookingInput,
    BLOCKING_STATUSES,
};
