const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: String,
        image: { url: String, filename: String },
        price: { type: Number, required: true, min: 0 },
        location: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true },
        category: { type: String, default: "City", trim: true },
        amenities: { type: [String], default: [] },
        guests: { type: Number, default: 4, min: 1 },
        reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
        owner: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// Indexed for the server-side search (location / price / category).
listingSchema.index({ location: 1 });
listingSchema.index({ price: 1 });
listingSchema.index({ category: 1 });
listingSchema.index({ country: 1 });
listingSchema.index({ createdAt: -1 });

listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
});

module.exports = mongoose.model("Listing", listingSchema);
