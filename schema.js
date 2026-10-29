const Joi = require("joi");

const AMENITIES = ["Wifi", "Pool", "Parking", "Kitchen", "AC", "Workspace", "Beach access", "Pets allowed"];
const CATEGORIES = ["City", "Nature", "Arctic", "Castle", "Boats", "Amazing pools"];

module.exports.AMENITIES = AMENITIES;
module.exports.CATEGORIES = CATEGORIES;

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().trim().required(),
        description: Joi.string().trim().required(),
        location: Joi.string().trim().required(),
        country: Joi.string().trim().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),
        imageUrl: Joi.string().uri().allow("", null),
        category: Joi.string().valid(...CATEGORIES).allow("", null),
        // Form sends amenities as a comma-separated string or as an array.
        amenities: Joi.alternatives().try(
            Joi.string().allow(""),
            Joi.array().items(Joi.string().valid(...AMENITIES))
        ),
        guests: Joi.number().integer().min(1).max(30).allow("", null),
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().trim().required(),
        bookingId: Joi.string().required(),
    }).required(),
});

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.date().required(),
        checkOut: Joi.date().required(),
        guests: Joi.number().integer().min(1).required(),
    }).required(),
});
