const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const cloudinaryConfigured = Boolean(
    process.env.CLOUD_NAME && process.env.CLOUD_API_KEY && process.env.CLOUD_API_SECRET
);

if (cloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.CLOUD_API_KEY,
        api_secret: process.env.CLOUD_API_SECRET,
    });
}

// Without Cloudinary keys, fall back to in-memory storage so listing creation
// does not crash — the controller then uses the supplied image URL or a
// placeholder. SVG/ICO were removed from allowed formats (SVG upload XSS risk).
const storage = cloudinaryConfigured
    ? new CloudinaryStorage({
          cloudinary,
          params: { folder: "luxestay_DEV", allowedFormats: ["png", "jpg", "jpeg", "webp"] },
      })
    : multer.memoryStorage();

module.exports = { cloudinary, storage, cloudinaryConfigured };
