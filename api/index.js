// Vercel serverless entry for the Express monolith.
// Sessions are in Mongo (connect-mongo) and the Mongoose connection is
// cached (see ensureDb in app.js), so cold starts do not lose sessions.
// Uploads never touch local disk: Cloudinary storage streams to Cloudinary,
// and without Cloudinary keys multer uses memory storage (see cloudConfig.js).
// If this entry cannot reach Mongo, it returns a clean 500 — it does not
// hang on Mongoose buffering the way the original app did.
const { app, configureApp, ensureDb } = require("../app.js");

module.exports = async (req, res) => {
    const dbUrl = process.env.MONGO_URL;
    if (!dbUrl) {
        return res.status(500).send("MONGO_URL is not set. Set it in Vercel environment variables.");
    }
    if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
        return res.status(500).send("SESSION_SECRET is not set. Set it in Vercel environment variables.");
    }
    try {
        await ensureDb(dbUrl);
        configureApp(dbUrl, process.env.SESSION_SECRET);
        return app(req, res);
    } catch (err) {
        console.error("Serverless DB error:", err.message);
        return res.status(500).send("Database connection failed. Check MONGO_URL (Atlas IP allow-list must include 0.0.0.0/0 for Vercel).");
    }
};
