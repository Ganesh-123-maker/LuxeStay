const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");

// Reviews are tied to a completed booking: the booking must belong to the
// reviewer, be for this listing, be completed, and not already be reviewed.
module.exports.createReview = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    const booking = await Booking.findById(req.body.review.bookingId);
    if (!booking || booking.listing.toString() !== listing._id.toString()) {
        req.flash("error", "That booking does not belong to this listing.");
        return res.redirect(`/listings/${listing._id}`);
    }
    if (booking.guest.toString() !== req.user._id.toString() || booking.status !== "completed") {
        req.flash("error", "You can only review a stay after it is completed.");
        return res.redirect(`/listings/${listing._id}`);
    }
    const existing = await Review.findOne({ booking: booking._id });
    if (existing) {
        req.flash("error", "You have already reviewed this booking.");
        return res.redirect(`/listings/${listing._id}`);
    }
    const newReview = new Review({
        rating: req.body.review.rating,
        comment: req.body.review.comment,
        booking: booking._id,
        listing: listing._id,
        author: req.user._id,
    });
    await newReview.save();
    listing.reviews.push(newReview);
    await listing.save();
    req.flash("success", "New Review Created!");
    res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
};
