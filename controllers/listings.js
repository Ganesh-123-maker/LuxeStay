const Listing = require("../models/listing");
const Booking = require("../models/booking");
const { AMENITIES, CATEGORIES } = require("../schema.js");
const { cloudinaryConfigured } = require("../cloudConfig.js");

const PLACEHOLDER_IMAGE =
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=60";

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeListingInput(input) {
    const out = { ...input };
    delete out.image;
    if (typeof out.amenities === "string") {
        out.amenities = out.amenities.split(",").map((a) => a.trim()).filter(Boolean);
    }
    if (out.guests === "" || out.guests === null || out.guests === undefined) {
        delete out.guests;
    } else {
        out.guests = Number(out.guests);
    }
    if (!out.category) out.category = "City";
    return out;
}

function avgRating(listing) {
    if (!listing.reviews || listing.reviews.length === 0) return null;
    const sum = listing.reviews.reduce((a, r) => a + (r.rating || 0), 0);
    return Math.round((sum / listing.reviews.length) * 10) / 10;
}

module.exports.index = async (req, res) => {
    const { q, location, minPrice, maxPrice, guests, category, amenity, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 9;
    const filter = {};
    if (q) {
        const rx = new RegExp(escapeRegex(q), "i");
        filter.$or = [{ title: rx }, { location: rx }, { country: rx }];
    }
    if (location) filter.location = new RegExp(escapeRegex(location), "i");
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (guests) filter.guests = { $gte: Number(guests) };
    if (category) filter.category = category;
    const amenities = amenity ? (Array.isArray(amenity) ? amenity : [amenity]) : [];
    if (amenities.length) filter.amenities = { $all: amenities };

    const sortMap = { priceAsc: { price: 1 }, priceDesc: { price: -1 }, newest: { createdAt: -1 } };
    const sortBy = sortMap[sort] || { createdAt: -1 };

    const total = await Listing.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const docs = await Listing.find(filter)
        .sort(sortBy)
        .skip((safePage - 1) * limit)
        .limit(limit)
        .populate("reviews", "rating");
    const allListings = docs.map((d) => {
        const obj = d.toObject();
        obj.avgRating = avgRating(d);
        return obj;
    });
    res.render("listings/index.ejs", {
        allListings,
        filters: { q: q || "", location: location || "", minPrice: minPrice || "", maxPrice: maxPrice || "", guests: guests || "", category: category || "", amenity: amenities, sort: sort || "newest" },
        page: safePage,
        totalPages,
        total,
        AMENITIES,
        CATEGORIES,
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs", { AMENITIES, CATEGORIES });
};

module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    const avg = avgRating(listing);
    // Completed bookings this user can review (and not yet reviewed).
    let reviewableBookings = [];
    if (req.user) {
        const completed = await Booking.find({ listing: id, guest: req.user._id, status: "completed" });
        const reviewed = await require("../models/review").find({ booking: { $in: completed.map((b) => b._id) } }).select("booking");
        const reviewedIds = new Set(reviewed.map((r) => r.booking.toString()));
        reviewableBookings = completed.filter((b) => !reviewedIds.has(b._id.toString()));
    }
    const wishlisted = req.user && req.user.wishlist
        ? req.user.wishlist.some((w) => w.toString() === listing._id.toString())
        : false;
    res.render("listings/show.ejs", { listing, avgRating: avg, reviewableBookings, wishlisted, stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY) });
};

module.exports.createListing = async (req, res) => {
    const data = normalizeListingInput(req.body.listing);
    const newListing = new Listing(data);
    newListing.owner = req.user._id;
    // File guard: never crash on a missing upload. Cloudinary file wins,
    // then an explicit image URL, then a safe placeholder.
    if (req.file && cloudinaryConfigured) {
        newListing.image = { url: req.file.path, filename: req.file.filename };
    } else if (req.body.listing.imageUrl) {
        newListing.image = { url: req.body.listing.imageUrl, filename: "external" };
    } else {
        newListing.image = { url: PLACEHOLDER_IMAGE, filename: "placeholder" };
    }
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    const imageUrl = listing.image && listing.image.url ? listing.image.url : PLACEHOLDER_IMAGE;
    const originalImageUrl = imageUrl.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalImageUrl, AMENITIES, CATEGORIES });
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const data = normalizeListingInput(req.body.listing);
    const listing = await Listing.findByIdAndUpdate(id, data, { new: true });
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    if (req.file && cloudinaryConfigured) {
        listing.image = { url: req.file.path, filename: req.file.filename };
        await listing.save();
    } else if (req.body.listing.imageUrl) {
        listing.image = { url: req.body.listing.imageUrl, filename: "external" };
        await listing.save();
    }
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};
