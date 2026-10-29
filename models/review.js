const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema(
    {
        comment: String,
        rating: { type: Number, min: 1, max: 5, required: true },
        createdAt: { type: Date, default: Date.now },
        // One review per completed booking. The stray self-referencing
        // `reviews` array from the original schema has been removed.
        booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
        listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
        author: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

reviewSchema.index({ booking: 1 }, { unique: true });
reviewSchema.index({ listing: 1 });

module.exports = mongoose.model("Review", reviewSchema);
