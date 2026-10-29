function idString(id) {
    return id ? id.toString() : null;
}

/** Listing owner, or an admin, may manage a listing. */
function canManageListing(user, listing) {
    if (!user || !listing) return false;
    if (user.role === "admin") return true;
    return idString(listing.owner) === idString(user._id);
}

/** Review author, or an admin, may delete a review. */
function canDeleteReview(user, review) {
    if (!user || !review) return false;
    if (user.role === "admin") return true;
    return idString(review.author) === idString(user._id);
}

function isAdmin(user) {
    return !!user && user.role === "admin";
}

function isHostOrAdmin(user) {
    return !!user && (user.role === "host" || user.role === "admin");
}

module.exports = { canManageListing, canDeleteReview, isAdmin, isHostOrAdmin };
