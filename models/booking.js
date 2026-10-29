const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
    {
        listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
        guest: { type: Schema.Types.ObjectId, ref: "User", required: true },
        host: { type: Schema.Types.ObjectId, ref: "User", required: true },
        checkIn: { type: Date, required: true },
        checkOut: { type: Date, required: true },
        guests: { type: Number, required: true, min: 1 },
        nights: { type: Number, required: true, min: 1 },
        totalPrice: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending",
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "refunded"],
            default: "pending",
        },
        stripeSessionId: { type: String, default: null },
    },
    { timestamps: true }
);

// The overlap query (checkIn < newCheckOut AND checkOut > newCheckIn) needs
// this compound index to stay fast as bookings grow.
bookingSchema.index({ listing: 1, checkIn: 1, checkOut: 1, status: 1 });
bookingSchema.index({ guest: 1, createdAt: -1 });
bookingSchema.index({ host: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
