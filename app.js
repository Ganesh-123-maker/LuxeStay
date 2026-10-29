if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const Booking = require("./models/booking.js");
const { constructWebhookEvent } = require("./services/paymentService.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js");
const adminRouter = require("./routes/admin.js");

const isProduction = process.env.NODE_ENV === "production";

// ---- Cached Mongoose connection (required for serverless / Vercel) ----
// Reused across warm invocations; without this every cold start would open
// a new connection and sessions/queries would race the connect.
let connectPromise = null;
async function ensureDb(dbUrl) {
    if (mongoose.connection.readyState === 1) return;
    if (!connectPromise) {
        connectPromise = mongoose.connect(dbUrl).catch((err) => {
            connectPromise = null;
            throw err;
        });
    }
    return connectPromise;
}

// ---- App wiring, run exactly once per process ----
let configured = false;
function configureApp(dbUrl, sessionSecret) {
    if (configured) return app;
    configured = true;

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));
    app.engine("ejs", ejsMate);

    // Stripe webhook needs the raw body — mount it BEFORE express.json().
    app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
        const result = constructWebhookEvent(req.body, req.headers["stripe-signature"]);
        if (!result.available) return res.status(400).send("Stripe webhook not configured.");
        const event = result.event;
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const bookingId = session.metadata && session.metadata.bookingId;
            if (bookingId) {
                await Booking.findByIdAndUpdate(bookingId, {
                    status: "confirmed",
                    paymentStatus: "paid",
                    stripeSessionId: session.id,
                });
            }
        }
        res.json({ received: true });
    });

    // CSP is relaxed (not disabled entirely via helmet defaults) because the
    // EJS views load Bootstrap/Font Awesome/Google Fonts from CDNs and use
    // small inline scripts. Tightening it requires removing those inline scripts.
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(mongoSanitize());
    app.use(methodOverride("_method"));
    app.use(express.static(path.join(__dirname, "/public")));

    // Sessions live in Mongo (connect-mongo), never in process memory, so a
    // serverless cold start or a Render restart does not log users out.
    const store = MongoStore.create({ mongoUrl: dbUrl, touchAfter: 24 * 3600 });
    store.on("error", (err) => console.error("SESSION STORE ERROR:", err.message));

    app.use(
        session({
            store,
            secret: sessionSecret || "dev-only-secret-do-not-use-in-production",
            resave: false,
            saveUninitialized: false,
            cookie: {
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
                maxAge: 7 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: isProduction,
                sameSite: "lax",
            },
        })
    );
    app.use(flash());
    app.use(passport.initialize());
    app.use(passport.session());
    passport.use(new LocalStrategy(User.authenticate()));
    passport.serializeUser(User.serializeUser());
    passport.deserializeUser(User.deserializeUser());

    app.use((req, res, next) => {
        res.locals.success = req.flash("success") || [];
        res.locals.error = req.flash("error") || [];
        res.locals.currUser = req.user || null;
        next();
    });

    app.get("/", (req, res) => res.redirect("/listings"));
    app.get("/privacy", (req, res) => res.render("pages/privacy.ejs"));
    app.get("/terms", (req, res) => res.render("pages/terms.ejs"));

    app.use("/listings", listingRouter);
    app.use("/listings/:id/reviews", reviewRouter);
    app.use("/admin", adminRouter);
    app.use("/", bookingRouter);
    app.use("/", userRouter);

    app.all("*", (req, res, next) => next(new ExpressError(404, "Page Not Found!")));

    // Central error handler: never leak stack traces in production.
    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || 500;
        if (!isProduction) console.error(err);
        const safeErr = {
            message: statusCode >= 500 && isProduction ? "Something went wrong!" : err.message || "Something went wrong!",
        };
        res.status(statusCode).render("error.ejs", { err: safeErr });
    });
    return app;
}

async function start() {
    const dbUrl = process.env.MONGO_URL;
    if (!dbUrl) {
        // Fail fast with a clear message, and never print the URL itself.
        throw new Error("MONGO_URL is not set. Copy .env.example to .env and set MONGO_URL, then restart.");
    }
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
        if (isProduction) {
            throw new Error("SESSION_SECRET is not set. Refusing to start in production without a session secret.");
        }
        console.warn("WARNING: SESSION_SECRET is not set. Using a dev-only secret — never use this in production.");
    }
    // Await the DB BEFORE listening. Previously main() was not awaited, so
    // the server printed "running" and then every route hung on buffering.
    await ensureDb(dbUrl);
    console.log("Connected to DB");
    configureApp(dbUrl, sessionSecret);
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Server is running on port ${port}`));
}

if (require.main === module) {
    start().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = { app, configureApp, ensureDb };
