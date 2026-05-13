/**
 * ExifExtractor.js
 * Uses the `exifr` library to extract GPS coordinates from an uploaded File.
 * Returns { lat, lng } or null if no GPS data is found.
 */
import exifr from 'exifr'

/**
 * @param {File} file — image File from <input> or dropzone
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function extractGpsFromFile(file) {
  try {
    const gps = await exifr.gps(file)
    if (gps && gps.latitude != null && gps.longitude != null) {
      return { lat: gps.latitude, lng: gps.longitude }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract a human-readable date from EXIF DateTimeOriginal, if present.
 * @param {File} file
 * @returns {Promise<string|null>} ISO date string YYYY-MM-DD
 */
export async function extractDateFromFile(file) {
  try {
    const data = await exifr.parse(file, ['DateTimeOriginal'])
    if (data?.DateTimeOriginal) {
      return new Date(data.DateTimeOriginal).toISOString().split('T')[0]
    }
    return null
  } catch {
    return null
  }
}
