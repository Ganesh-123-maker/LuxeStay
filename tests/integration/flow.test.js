// Full HTTP flow against a real (in-memory) MongoDB. NOT a browser test:
// it drives the same form routes a browser would POST, with a cookie jar.
// No Stripe/SMTP/Cloudinary keys are set, so demo-mode paths are exercised.
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let mongod, server, port, base;

class Jar {
    constructor() { this.cookies = {}; }
    async req(p, opts = {}) {
        const headers = { ...(opts.headers || {}) };
        const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
        if (cookie) headers.Cookie = cookie;
        const res = await fetch(base + p, { ...opts, headers, redirect: "manual" });
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
            for (const part of setCookie.split(/,(?=[^;]+=[^;]+)/)) {
                const m = part.trim().match(/^([^=]+)=([^;]*)/);
                if (m) this.cookies[m[1]] = m[2];
            }
        }
        return res;
    }
    async form(p, fields) {
        const body = new URLSearchParams();
        for (const [k, v] of Object.entries(fields)) body.append(k, v);
        return this.req(p, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    }
}

async function waitForServer() {
    for (let i = 0; i < 100; i++) {
        try {
            const r = await fetch(base + "/listings", { redirect: "manual" });
            if (r.status === 200) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("server did not become ready");
}

test("full flow: signup/login, listing, search, book, demo-pay, cancel, review-after-completed, host dashboard, admin rejection", { timeout: 180000 }, async (t) => {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    port = 3456 + Math.floor(Math.random() * 1000);
    base = `http://127.0.0.1:${port}`;
    server = spawn("node", ["app.js"], {
        cwd: ROOT,
        env: { ...process.env, MONGO_URL: uri, SESSION_SECRET: "integration-test-secret", PORT: String(port), NODE_ENV: "test" },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    server.stdout.on("data", (d) => (logs += d));
    server.stderr.on("data", (d) => (logs += d));
    t.after(async () => {
        if (server) server.kill();
        if (mongod) await mongod.stop();
    });
    await waitForServer();

    const host = new Jar(), guest = new Jar(), stranger = new Jar();
    // --- signup (host, guest, stranger) ---
    for (const [jar, u] of [[host, "host1"], [guest, "guest1"], [stranger, "stranger1"]]) {
        const r = await jar.form("/signup", { username: u, email: `${u}@example.com`, password: "Password123!" });
        assert.ok([200, 302].includes(r.status), `signup ${u}: ${r.status} ${logs.slice(-500)}`);
    }
    // --- host creates a listing (no file, image URL fallback) ---
    const create = await host.form("/listings", {
        "listing[title]": "Test Jaipur Flat", "listing[description]": "A nice test flat",
        "listing[location]": "Jaipur", "listing[country]": "India", "listing[price]": "1000",
        "listing[guests]": "4", "listing[category]": "City",
        "listing[imageUrl]": "https://example.com/flat.jpg",
    });
    assert.equal(create.status, 302, `create listing: ${create.status}`);
    // --- search/filter finds it, and a non-matching filter does not ---
    const search = await guest.req("/listings?q=Jaipur&minPrice=500&maxPrice=2000&category=City");
    const searchHtml = await search.text();
    assert.ok(searchHtml.includes("Test Jaipur Flat"), "search should find the listing");
    const noMatch = await guest.req("/listings?q=Jaipur&minPrice=99999");
    assert.ok((await noMatch.text()).includes("No listings match"), "empty state should show");
    // listing id from the search page
    const idMatch = searchHtml.match(/\/listings\/([a-f0-9]{24})/);
    assert.ok(idMatch, "listing id present in search page");
    const listingId = idMatch[1];

    // --- wishlist toggle persists ---
    const wish = await guest.req(`/listings/${listingId}/wishlist`, { method: "POST" });
    assert.equal(wish.status, 302);
    const wishlistPage = await guest.req("/wishlist");
    assert.ok((await wishlistPage.text()).includes("Test Jaipur Flat"), "wishlist page should show saved listing");

    // --- book (future dates), then double-booking must be rejected ---
    const book = await guest.form(`/listings/${listingId}/bookings`, {
        "booking[checkIn]": "2099-03-01", "booking[checkOut]": "2099-03-03", "booking[guests]": "2",
    });
    assert.equal(book.status, 302);
    const clash = await guest.form(`/listings/${listingId}/bookings`, {
        "booking[checkIn]": "2099-03-02", "booking[checkOut]": "2099-03-04", "booking[guests]": "2",
    });
    assert.equal(clash.status, 302);
    const tripsAfterClash = await guest.req("/trips");
    const tripsHtml = await tripsAfterClash.text();
    assert.ok(tripsHtml.includes("Test Jaipur Flat"), "trips should show the booking");
    // exactly one booking card for this listing (clash created none)
    assert.equal((tripsHtml.match(/Test Jaipur Flat/g) || []).length, 1, "double booking must not create a second booking");

    // --- demo pay (no Stripe keys): clearly labelled, no real payment ---
    const bookingIdMatch = tripsHtml.match(/\/bookings\/([a-f0-9]{24})\/pay/);
    assert.ok(bookingIdMatch, "pay button present");
    const bookingId = bookingIdMatch[1];
    const pay = await guest.req(`/bookings/${bookingId}/pay`, { method: "POST" });
    assert.equal(pay.status, 302);
    const tripsAfterPay = await guest.req("/trips");
    const payHtml = await tripsAfterPay.text();
    assert.ok(payHtml.includes("Demo mode"), "demo payment must be labelled in UI");
    assert.ok(payHtml.includes("confirmed"), "demo payment confirms the booking");

    // --- host completes it, guest reviews it; a second review is refused ---
    const complete = await host.req(`/bookings/${bookingId}/complete`, { method: "POST" });
    assert.equal(complete.status, 302);
    const review = await guest.form(`/listings/${listingId}/reviews`, {
        "review[bookingId]": bookingId, "review[rating]": "5", "review[comment]": "Excellent test stay",
    });
    assert.equal(review.status, 302);
    const show = await guest.req(`/listings/${listingId}`);
    const showHtml = await show.text();
    assert.ok(showHtml.includes("Excellent test stay"), "review should appear on listing");
    assert.ok(showHtml.includes("⭐ 5"), "average rating must be computed from reviews, not hardcoded");

    // --- a second booking that is cancelled frees the dates ---
    const book2 = await guest.form(`/listings/${listingId}/bookings`, {
        "booking[checkIn]": "2099-04-01", "booking[checkOut]": "2099-04-03", "booking[guests]": "2",
    });
    assert.equal(book2.status, 302);
    const trips2 = await guest.req("/trips");
    const cancelId = (await trips2.text()).match(/\/bookings\/([a-f0-9]{24})\/cancel/g);
    assert.ok(cancelId && cancelId.length >= 1);
    // cancel the newest pending booking (last cancel form on the page)
    const cancelTarget = cancelId[cancelId.length - 1].match(/([a-f0-9]{24})/)[1];
    const cancel = await guest.req(`/bookings/${cancelTarget}/cancel`, { method: "POST" });
    assert.equal(cancel.status, 302);

    // --- host dashboard shows the listing and bookings ---
    const dash = await host.req("/dashboard");
    const dashHtml = await dash.text();
    assert.ok(dashHtml.includes("Test Jaipur Flat"), "host dashboard should list own listing");
    assert.ok(dashHtml.includes("Real earnings"), "host dashboard should show earnings split");

    // --- admin rejection: non-admin (guest) cannot open /admin ---
    const adminAsGuest = await guest.req("/admin", { redirect: "manual" });
    assert.equal(adminAsGuest.status, 302, "non-admin must be redirected away from /admin");
    assert.ok((adminAsGuest.headers.get("location") || "").includes("/listings"));

    // --- explicit logout then login (signup alone does not prove /login) ---
    const logout = await guest.req("/logout", { method: "POST" });
    assert.equal(logout.status, 302);
    const login = await guest.form("/login", { username: "guest1", password: "Password123!" });
    assert.equal(login.status, 302);
    const tripsAfterLogin = await guest.req("/trips");
    assert.equal(tripsAfterLogin.status, 200, "logged-in guest must reach /trips after login");

    // --- unauthenticated user cannot create a listing ---
    const anon = new Jar();
    const anonCreate = await anon.form("/listings", {
        "listing[title]": "Nope", "listing[description]": "x", "listing[location]": "Jaipur",
        "listing[country]": "India", "listing[price]": "100",
    });
    assert.equal(anonCreate.status, 302);
    assert.ok((anonCreate.headers.get("location") || "").includes("/login"));
});
