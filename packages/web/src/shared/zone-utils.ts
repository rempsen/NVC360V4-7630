/**
 * Shared zone utilities — used by API routes (enforcement) and reports (attribution).
 * No external deps — pure math only.
 */

export type LatLng = [number, number]; // [lat, lng]

/** Ray-casting point-in-polygon test. poly is [[lat,lng], ...]. */
export function inPoly(lat: number, lng: number, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Returns true if [lat,lng] is inside at least one active zone (polygon). */
export function isInAnyZone(lat: number, lng: number, zones: Array<{ polygon: LatLng[]; active: boolean }>): boolean {
  const active = zones.filter((z) => z.active && z.polygon.length >= 3);
  if (active.length === 0) return true; // no zones defined → unrestricted
  return active.some((z) => inPoly(lat, lng, z.polygon));
}

/**
 * Approximate a circle as a closed polygon (n points).
 * center: [lat, lng], radiusM: meters, n: vertex count (default 64).
 */
export function circleToPolygon(centerLat: number, centerLng: number, radiusM: number, n = 64): LatLng[] {
  const pts: LatLng[] = [];
  const latRad = (centerLat * Math.PI) / 180;
  const dLat = (radiusM / 111320) * (180 / Math.PI);
  const dLng = (radiusM / (111320 * Math.cos(latRad))) * (180 / Math.PI);
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    pts.push([centerLat + dLat * Math.sin(angle), centerLng + dLng * Math.cos(angle)]);
  }
  return pts;
}

/**
 * Convert two opposite corners to a 4-point rectangle polygon.
 */
export function rectToPolygon(lat1: number, lng1: number, lat2: number, lng2: number): LatLng[] {
  return [
    [lat1, lng1],
    [lat1, lng2],
    [lat2, lng2],
    [lat2, lng1],
  ];
}
