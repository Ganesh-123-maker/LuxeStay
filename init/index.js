if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const Booking = require("../models/booking.js");
const Review = require("../models/review.js");

// Seed script. Uses MONGO_URL (same as app.js — the old ATLASDB_URL was
// never read by the app). Only wipes collections with --reset.
// Demo passwords below are demo-only; change them after seeding.
const DEMO_USERS = [
    { username: "guest", email: "guest@luxestay.demo", password: "Guest123!", role: "guest" },
    { username: "host", email: "host@luxestay.demo", password: "Host123!", role: "host" },
    { username: "admin", email: "admin@luxestay.demo", password: "Admin123!", role: "admin" },
];

async function getOrCreateUser({ username, email, password, role }) {
    let user = await User.findOne({ username });
    if (user) return user;
    user = new User({ username, email, role });
    await User.register(user, password);
    return user;
}

async function main() {
    const dbUrl = process.env.MONGO_URL;
    if (!dbUrl) throw new Error("MONGO_URL is not set. Copy .env.example to .env and set MONGO_URL.");
    await mongoose.connect(dbUrl);
    const reset = process.argv.includes("--reset");
    if (reset) {
        await Promise.all([
            Review.deleteMany({}),
            Booking.deleteMany({}),
            Listing.deleteMany({}),
            User.deleteMany({}),
        ]);
        console.log("Collections wiped (--reset).");
    }

    const users = {};
    for (const u of DEMO_USERS) users[u.username] = await getOrCreateUser(u);
    const host = users.host;
    const guest = users.guest;

    const existing = await Listing.countDocuments({});
    if (existing === 0) {
        const listings = initData.data.map((obj, i) => ({
            ...obj,
            owner: host._id,
            category: ["City", "Nature", "Castle", "Amazing pools"][i % 4],
            amenities: i % 2 === 0 ? ["Wifi", "Kitchen"] : ["Wifi", "Pool", "Parking"],
            guests: 2 + (i % 5),
        }));
        await Listing.insertMany(listings);
        console.log(`Seeded ${listings.length} listings owned by host.`);
    } else {
        console.log(`Listings already present (${existing}) — not re-seeding listings.`);
    }

    const first = await Listing.findOne({ owner: host._id });
    const completedExists = await Booking.findOne({ guest: guest._id, status: "completed" });
    if (first && !completedExists) {
        const booking = new Booking({
            listing: first._id,
            guest: guest._id,
            host: host._id,
            checkIn: new Date("2026-01-05"),
            checkOut: new Date("2026-01-08"),
            guests: 2,
            nights: 3,
            totalPrice: Math.round(first.price * 3 * 1.18),
            status: "completed",
            paymentStatus: "paid",
        });
        await booking.save();
        first.reviews = first.reviews || [];
        const review = new Review({
            rating: 5,
            comment: "Lovely stay — exactly as listed.",
            booking: booking._id,
            listing: first._id,
            author: guest._id,
        });
        await review.save();
        first.reviews.push(review._id);
        await first.save();
        console.log("Seeded one completed booking + review (guest can review other completed stays too).");
    }
    console.log("Demo logins (demo-only, change after seeding):");
    for (const u of DEMO_USERS) console.log(`  ${u.role}: ${u.username} / ${u.password}`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
