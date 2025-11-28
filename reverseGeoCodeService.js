import axios from "axios";

const reverseGeoCodeService = {};
const GOOGLE_MAPS_API_KEY = "AIzaSyBucHHSLvAcbRq3CWGkRzzdYo7Da8hIzCQ";

reverseGeoCodeService.fetchLocations = async (latitude, longitude) => {
  try {
    const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
    const { data } = await axios.get(apiUrl, {
      params: {
        latlng: `${latitude},${longitude}`,
        key: GOOGLE_MAPS_API_KEY,
      },
    });
    return data;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

export default reverseGeoCodeService;