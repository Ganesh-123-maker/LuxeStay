const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, validateBooking } = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");

router.post("/listings/:id/bookings", isLoggedIn, validateBooking, wrapAsync(bookingController.createBooking));
router.post("/bookings/:id/cancel", isLoggedIn, wrapAsync(bookingController.cancelBooking));
router.post("/bookings/:id/confirm", isLoggedIn, wrapAsync(bookingController.confirmBooking));
router.post("/bookings/:id/complete", isLoggedIn, wrapAsync(bookingController.completeBooking));
router.post("/bookings/:id/pay", isLoggedIn, wrapAsync(bookingController.payBooking));

module.exports = router;
