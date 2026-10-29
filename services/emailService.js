// Booking-confirmation email via nodemailer. When SMTP env vars are absent
// it does NOT claim to send: in non-production it logs the would-be email
// and returns { sent: false, reason }, which controllers surface honestly.
function smtpConfigured() {
    return Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );
}

async function sendBookingConfirmation({ to, listingTitle, checkIn, checkOut, guests, total }) {
    if (!smtpConfigured()) {
        const text =
            `[email-dev] To: ${to} | Booking confirmed: ${listingTitle} ` +
            `${checkIn} -> ${checkOut}, ${guests} guest(s), total ₹${total}`;
        if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
            console.log(text);
        }
        return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
    }
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: `LuxeStay booking confirmed: ${listingTitle}`,
        text:
            `Your LuxeStay booking is confirmed.\n\n` +
            `${listingTitle}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\n` +
            `Guests: ${guests}\nTotal (incl. 18% GST): ₹${total}\n`,
    });
    return { sent: true };
}

module.exports = { smtpConfigured, sendBookingConfirmation };
