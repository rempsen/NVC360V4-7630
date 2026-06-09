/** Great-circle distance in km between two lat/lng points (Haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Geofence test: is a point within `radiusMeters` of a target?
 * Pure helper shared by the tracking auto-arrive/clock logic so the threshold
 * decision is unit-testable independently of the request/DB path.
 */
export function isInsideGeofence(
  lat: number,
  lng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number,
): boolean {
  const radiusKm = (radiusMeters || 0) / 1000;
  return haversineKm(lat, lng, targetLat, targetLng) <= radiusKm;
}

/** Sum consecutive pings into total path distance (km). Filters GPS jitter < 5m and jumps > 5km. */
export function pathDistanceKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    if (d > 0.005 && d < 5) total += d;
  }
  return Math.round(total * 100) / 100;
}
