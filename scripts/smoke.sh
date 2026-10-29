#!/bin/bash
# LuxeStay post-deploy smoke test, run against a live BASE_URL.
# Usage: BASE_URL=http://127.0.0.1:3000 bash scripts/smoke.sh
# Defaults to http://127.0.0.1:3000 when BASE_URL is unset.
# Requires the app to be running and seeded (npm run seed, without --reset).
set -u
BASE=${BASE_URL:-http://127.0.0.1:3000}
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR" || exit 1
FAIL=0
# Unique title per run so re-runs against the same database do not collide
# with earlier smoke listings/bookings when counting trips.
TITLE="SmokeTestStay-$RANDOM"
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }
login() {
  code=$(curl -s -c "$1" -o /dev/null -w "%{http_code}" -X POST "$BASE/login" -d "username=$2&password=$3")
  if [ "$code" = "302" ]; then pass "$2 login -> 302"; else fail "$2 login (got $code)"; fi
}
login guest.jar guest Guest123!
login host.jar host Host123!
login admin.jar admin Admin123!

loc=$(curl -s -o /dev/null -w "%{redirect_url}" -X POST "$BASE/listings" -d "listing[title]=Nope")
case "$loc" in *"/login"*) pass "anonymous create redirects to /login";; *) fail "anonymous create redirect: $loc";; esac
code=$(curl -s -b guest.jar -o /dev/null -w "%{http_code}" "$BASE/admin")
if [ "$code" = "302" ]; then pass "non-admin /admin rejected (302)"; else fail "non-admin /admin (got $code)"; fi
code=$(curl -s -b admin.jar -o /dev/null -w "%{http_code}" "$BASE/admin")
if [ "$code" = "200" ]; then pass "admin /admin loads"; else fail "admin /admin (got $code)"; fi

curl -s -b host.jar -o /dev/null -X POST "$BASE/listings" \
  -d "listing[title]=$TITLE&listing[description]=Smoke test&listing[price]=1000&listing[guests]=4&listing[category]=City&listing[country]=India&listing[location]=Jaipur, Rajasthan&listing[imageUrl]=https://images.unsplash.com/photo-1501785888041-af3ef285b470"
LISTING_ID=$(curl -s -b guest.jar "$BASE/listings?q=Smoke" | grep -oE 'href="/listings/[a-f0-9]{24}"' | head -1 | sed 's/.*listings\///;s/"//')
if [ -n "$LISTING_ID" ]; then pass "listing created and found by search: $LISTING_ID"; else fail "listing ID extraction"; fi
echo "LISTING_ID=$LISTING_ID"

curl -s -b guest.jar -o /dev/null -X POST "$BASE/listings/$LISTING_ID/bookings" \
  -d "booking[checkIn]=2027-03-01&booking[checkOut]=2027-03-03&booking[guests]=2"
if curl -s -b guest.jar "$BASE/trips" | grep -q "2,360"; then pass "GST total 2,360 on /trips"; else fail "GST total on /trips"; fi

curl -s -b guest.jar -o /dev/null -X POST "$BASE/listings/$LISTING_ID/bookings" \
  -d "booking[checkIn]=2027-03-02&booking[checkOut]=2027-03-04&booking[guests]=2"
COUNT=$(curl -s -b guest.jar "$BASE/trips" | grep -c "$TITLE" || true)
if [ "$COUNT" = "1" ]; then pass "overlap rejected — still 1 booking for this listing"; else fail "overlap check — trips shows $COUNT copies"; fi

BOOKING_ID=$(curl -s -b guest.jar "$BASE/trips" | grep -oE 'bookings/[a-f0-9]{24}/pay' | head -1 | sed 's/bookings\///;s/\/pay//')
echo "BOOKING_ID=$BOOKING_ID"
curl -s -b guest.jar -o /dev/null -X POST "$BASE/bookings/$BOOKING_ID/pay"
if curl -s -b guest.jar "$BASE/trips" | grep -q "Demo mode"; then pass "demo payment badge shown (no Stripe keys)"; elif curl -s -b guest.jar "$BASE/trips" | grep -q "paid"; then pass "payment marked paid"; else fail "payment status on /trips"; fi

curl -s -b host.jar -o /dev/null -X POST "$BASE/bookings/$BOOKING_ID/complete"
if curl -s -b host.jar "$BASE/dashboard" | grep -q "Real earnings"; then pass "host dashboard loads with earnings split"; else fail "host dashboard earnings"; fi

curl -s -b guest.jar -o /dev/null -X POST "$BASE/listings/$LISTING_ID/reviews" \
  -d "review[bookingId]=$BOOKING_ID&review[rating]=5&review[comment]=Smoke test review"
if curl -s -b guest.jar "$BASE/listings/$LISTING_ID" | grep -q "Smoke test review"; then pass "review after completed booking appears"; else fail "review on listing page"; fi

echo "SMOKE_EXIT=$FAIL"
exit $FAIL
