const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const rateLimit = require("express-rate-limit");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const userController = require("../controllers/users.js");

// Auth rate limiting: 20 attempts / 15 min per IP.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many auth attempts. Please try again in 15 minutes.",
});

router
    .route("/signup")
    .get(userController.renderSignupForm)
    .post(authLimiter, wrapAsync(userController.signup));

router
    .route("/login")
    .get(userController.renderLoginForm)
    .post(
        authLimiter,
        saveRedirectUrl,
        passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }),
        userController.login
    );

// Logout is POST (GET no longer logs anyone out — that was a CSRF hole).
router.post("/logout", userController.logout);
router.get("/logout", (req, res) => {
    req.flash("error", "Please use the Logout button.");
    res.redirect("/listings");
});

router.get("/trips", isLoggedIn, wrapAsync(userController.trips));
router.get("/wishlist", isLoggedIn, wrapAsync(userController.wishlistPage));
router.post("/listings/:id/wishlist", isLoggedIn, wrapAsync(userController.toggleWishlist));
router.get("/dashboard", isLoggedIn, wrapAsync(userController.hostDashboard));

module.exports = router;
