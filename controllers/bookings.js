const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const { calculateTotal, overlapFilter, validateBookingInput } = require("../services/bookingService.js");
const { createCheckoutSession } = require("../services/paymentService.js");
const { sendBookingConfirmation } = require("../services/emailService.js");

module.exports.createBooking = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash("error", "Listing does not exist.");
        return res.redirect("/listings");
    }
    const { checkIn, checkOut, guests } = req.body.booking;
    const errors = validateBookingInput({ checkIn, checkOut, guests, maxGuests: listing.guests });
    if (errors.length) {
        req.flash("error", errors.join(" "));
        return res.redirect(`/listings/${listing._id}`);
    }
    const clash = await Booking.findOne(overlapFilter(listing._id, checkIn, checkOut));
    if (clash) {
        req.flash("error", "Those dates are already booked. Please pick different dates.");
        return res.redirect(`/listings/${listing._id}`);
    }
    const { nights, total } = calculateTotal(listing.price, checkIn, checkOut);
    const booking = new Booking({
        listing: listing._id,
        guest: req.user._id,
        host: listing.owner,
        checkIn,
        checkOut,
        guests: Number(guests),
        nights,
        totalPrice: total,
        status: "pending",
        paymentStatus: "pending",
    });
    await booking.save();
    req.flash(
        "success",
        "Booking created (pending payment). Pay with Stripe from your Trips page when test keys are configured, or ask the host to confirm it."
    );
    res.redirect("/trips");
};

module.exports.cancelBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        req.flash("error", "Booking does not exist.");
        return res.redirect("/trips");
    }
    const isParty =
        booking.guest.toString() === req.user._id.toString() ||
        booking.host.toString() === req.user._id.toString() ||
        req.user.role === "admin";
    if (!isParty) {
        req.flash("error", "You cannot cancel this booking.");
        return res.redirect("/trips");
    }
    if (["cancelled", "completed"].includes(booking.status)) {
        req.flash("error", `Booking is already ${booking.status}.`);
        return res.redirect("/trips");
    }
    booking.status = "cancelled";
    await booking.save();
    req.flash("success", "Booking cancelled.");
    res.redirect("/trips");
};

// Host/admin only: confirm a pending booking (used when Stripe is not
// configured, and by hosts who accept offline). Does not fake a payment.
module.exports.confirmBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate("listing");
    if (!booking) {
        req.flash("error", "Booking does not exist.");
        return res.redirect("/dashboard");
    }
    if (booking.host.toString() !== req.user._id.toString() && req.user.role !== "admin") {
        req.flash("error", "Only the host can confirm this booking.");
        return res.redirect("/dashboard");
    }
    if (booking.status !== "pending") {
        req.flash("error", `Booking is already ${booking.status}.`);
        return res.redirect("/dashboard");
    }
    booking.status = "confirmed";
    await booking.save();
    await sendBookingConfirmation({
        to: req.user.email,
        listingTitle: booking.listing ? booking.listing.title : "LuxeStay listing",
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        guests: booking.guests,
        total: booking.totalPrice,
    });
    req.flash("success", "Booking confirmed.");
    res.redirect("/dashboard");
};

// Host/admin only: mark a confirmed booking completed so guests can review it.
module.exports.completeBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        req.flash("error", "Booking does not exist.");
        return res.redirect("/dashboard");
    }
    if (booking.host.toString() !== req.user._id.toString() && req.user.role !== "admin") {
        req.flash("error", "Only the host can complete this booking.");
        return res.redirect("/dashboard");
    }
    if (booking.status !== "confirmed") {
        req.flash("error", "Only a confirmed booking can be completed.");
        return res.redirect("/dashboard");
    }
    booking.status = "completed";
    await booking.save();
    req.flash("success", "Booking marked completed. The guest can now leave a review.");
    res.redirect("/dashboard");
};

module.exports.payBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate("listing");
    if (!booking || booking.guest.toString() !== req.user._id.toString()) {
        req.flash("error", "Booking not found.");
        return res.redirect("/trips");
    }
    if (booking.status !== "pending") {
        req.flash("error", `Booking is already ${booking.status}.`);
        return res.redirect("/trips");
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await createCheckoutSession(booking, booking.listing, baseUrl);
    if (!result.available) {
        req.flash("error", `Stripe is not configured: ${result.reason} Booking stays pending.`);
        return res.redirect("/trips");
    }
    booking.stripeSessionId = result.sessionId;
    await booking.save();
    res.redirect(result.url);
};
