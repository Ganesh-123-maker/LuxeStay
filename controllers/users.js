const User = require("../models/user.js");
const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");

module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// Fixed: signature is (req, res, next) so the req.login error path can
// actually call next(err) instead of throwing a ReferenceError.
module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to LuxeStay!");
            res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

module.exports.login = (req, res) => {
    req.flash("success", "Welcome back!");
    const redirectUrl = res.locals.redirectUrl || "/listings";
    return res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
};

module.exports.trips = async (req, res) => {
    const bookings = await Booking.find({ guest: req.user._id })
        .sort({ createdAt: -1 })
        .populate("listing");
    res.render("users/trips.ejs", { bookings });
};

module.exports.wishlistPage = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.render("users/wishlist.ejs", { wishlist: user.wishlist || [] });
};

module.exports.toggleWishlist = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing does not exist.");
        return res.redirect("/listings");
    }
    const user = await User.findById(req.user._id);
    const idx = user.wishlist.findIndex((w) => w.toString() === id);
    if (idx >= 0) {
        user.wishlist.splice(idx, 1);
        req.flash("success", "Removed from wishlist.");
    } else {
        user.wishlist.push(listing._id);
        req.flash("success", "Saved to wishlist.");
    }
    await user.save();
    res.redirect(`/listings/${id}`);
};

module.exports.hostDashboard = async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });
    const bookings = await Booking.find({ host: req.user._id })
        .sort({ createdAt: -1 })
        .populate("listing")
        .populate("guest", "username");
    const earnings = bookings
        .filter((b) => ["confirmed", "completed"].includes(b.status))
        .reduce((sum, b) => sum + b.totalPrice, 0);
    res.render("dashboard/host.ejs", { listings, bookings, earnings });
};
