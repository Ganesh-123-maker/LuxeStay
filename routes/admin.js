const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isAdmin } = require("../middleware.js");
const adminController = require("../controllers/admin.js");

router.use(isLoggedIn, isAdmin);

router.get("/", wrapAsync(adminController.index));
router.get("/users", wrapAsync(adminController.users));
router.get("/listings", wrapAsync(adminController.listings));
router.get("/bookings", wrapAsync(adminController.bookings));
router.post("/listings/:id/delete", wrapAsync(adminController.deleteListing));
router.post("/bookings/:id/cancel", wrapAsync(adminController.cancelBooking));

module.exports = router;
