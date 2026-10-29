const User = require("../models/user.js");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");

module.exports.index = async (req, res) => {
    const [userCount, listingCount, bookingCount] = await Promise.all([
        User.countDocuments({}),
        Listing.countDocuments({}),
        Booking.countDocuments({}),
    ]);
    res.render("admin/index.ejs", { userCount, listingCount, bookingCount });
};

module.exports.users = async (req, res) => {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.render("admin/users.ejs", { users });
};

module.exports.listings = async (req, res) => {
    const listings = await Listing.find({}).sort({ createdAt: -1 }).populate("owner", "username");
    res.render("admin/listings.ejs", { listings });
};

module.exports.bookings = async (req, res) => {
    const bookings = await Booking.find({})
        .sort({ createdAt: -1 })
        .populate("listing", "title")
        .populate("guest", "username")
        .populate("host", "username");
    res.render("admin/bookings.ejs", { bookings });
};

module.exports.deleteListing = async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
    req.flash("success", "Listing deleted by admin.");
    res.redirect("/admin/listings");
};

module.exports.cancelBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (booking && !["cancelled", "completed"].includes(booking.status)) {
        booking.status = "cancelled";
        await booking.save();
    }
    req.flash("success", "Booking cancelled by admin.");
    res.redirect("/admin/bookings");
};
