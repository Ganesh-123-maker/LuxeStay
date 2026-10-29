const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema(
    {
        email: { type: String, required: true, trim: true },
        role: {
            type: String,
            enum: ["guest", "host", "admin"],
            default: "guest",
        },
        wishlist: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
    },
    { timestamps: true }
);

// passport-local-mongoose hashes passwords (PBKDF2) — no plaintext storage.
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
