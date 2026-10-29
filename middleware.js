const Listing = require("./models/listing");
const Review = require("./models/review");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, bookingSchema } = require("./schema.js");
const { canManageListing, canDeleteReview, isAdmin } = require("./services/authorization.js");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        if (req.session) req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to do that.");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session && req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    if (!canManageListing(res.locals.currUser, listing)) {
        req.flash("error", "You are not the owner of this listing");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    if (!isAdmin(res.locals.currUser)) {
        req.flash("error", "Admin access only.");
        return res.redirect("/listings");
    }
    next();
};

function validate(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const errMsg = error.details.map((el) => el.message).join(",");
            throw new ExpressError(400, errMsg);
        }
        next();
    };
}

module.exports.validateListing = validate(listingSchema);
module.exports.validateReview = validate(reviewSchema);
module.exports.validateBooking = validate(bookingSchema);

module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
        req.flash("error", "Review does not exist.");
        return res.redirect(`/listings/${id}`);
    }
    if (!canDeleteReview(res.locals.currUser, review)) {
        req.flash("error", "You are not the author of this review");
        return res.redirect(`/listings/${id}`);
    }
    next();
};
