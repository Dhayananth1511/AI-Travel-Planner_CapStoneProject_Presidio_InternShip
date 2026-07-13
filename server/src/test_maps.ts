import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function test() {
  console.log("Checking GOOGLE_MAPS_API_KEY:", GOOGLE_API_KEY);
  const destination = 'Manali';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`;
  console.log("Url:", url);
  try {
    const geoRes = await fetch(url);
    const geoData: any = await geoRes.json();
    console.log("Geocoding Status:", geoRes.status);
    console.log("Geocoding Response Body:", JSON.stringify(geoData, null, 2));
  } catch (error: any) {
    console.error("ERROR FETCHING GEODATA:", error.message || error);
  }
}

test();
