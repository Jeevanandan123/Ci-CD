import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PermissionsAndroid, Platform, Alert, Linking, AppState } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Geolocation from 'react-native-geolocation-service';

// Define VIDEO_DIR with a proper path
const VIDEO_DIR = Platform.OS === 'android' 
  ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/CameraApp` 
  : `${RNFS.DocumentDirectoryPath}/Videos`;

const DEFAULTS = {
  resolution: '1080p',
  locationEnabled: true,
  timestampFormat: 'yyyy-MM-dd HH:mm:ss',
};

function formatTimestamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export default function CameraScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const [front, setFront] = useState(false);
  const device = useCameraDevice(front ? 'front' : 'back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const micPermission = useMicrophonePermission();
  const [recording, setRecording] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [settings, setSettings] = useState(DEFAULTS);
  const [locationBadge, setLocationBadge] = useState('');
  const [liveStamp, setLiveStamp] = useState('');
  const [hasGalleryPermission, setHasGalleryPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [address, setAddress] = useState('');

  // Load settings when screen comes into focus
  useEffect(() => {
    console.log('CameraScreen focused, loading settings jeeva');
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.multiGet(['resolution', 'locationEnabled', 'autoDeleteDays']);
        const newSettings = { ...DEFAULTS };
        stored.forEach(([k, v]) => {
          if (v == null) return;
          if (k === 'locationEnabled') newSettings[k] = v === 'true';
          else newSettings[k] = v;
        });
        setSettings(newSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    const unsubscribe = navigation.addListener('focus', loadSettings);
    loadSettings();

    return unsubscribe;
  }, [navigation]);

  // Update location badge when settings change
  useEffect(() => {
    setLocationBadge(settings.locationEnabled ? 'Location ON' : 'Location OFF');
  }, [settings.locationEnabled]);

  // Request location permissions
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to tag videos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        setHasLocationPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Location permission error:', err);
        return false;
      }
    } else {
      // For iOS, use Geolocation's built-in permission request
      try {
        const result = await Geolocation.requestAuthorization('whenInUse');
        setHasLocationPermission(result === 'granted');
        return result === 'granted';
      } catch (error) {
        console.error('iOS location permission error:', error);
        return false;
      }
    }
  };

  // Check and request location permissions
  useEffect(() => {
    const checkLocationPermission = async () => {
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        setHasLocationPermission(hasPermission);
      } else {
        // For iOS, we'll assume we need to request permission
        Geolocation.getCurrentPosition(
          () => setHasLocationPermission(true),
          () => setHasLocationPermission(false)
        );
      }
    };
    
    checkLocationPermission();
  }, []);

  // Function to get address from coordinates using reverse geocoding
const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const GOOGLE_MAPS_API_KEY = "AIzaSyBucHHSLvAcbRq3CWGkRzzdYo7Da8hIzCQ";
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.status === 'OK' && data.results && data.results.length > 0) {
      const formattedAddress = data.results[0].formatted_address;
      
      // Split the formatted address by commas and join with newlines
      const addressLines = formattedAddress.split(',').map(line => line.trim());
      
      // Add coordinates at the end
      addressLines.push(`Lat: ${latitude.toFixed(6)}`);
      addressLines.push(`Lon: ${longitude.toFixed(6)}`);
      
      return addressLines.join('\n');
    }
    
    // Fallback: just return coordinates if no address found
    return `Lat: ${latitude.toFixed(6)}\nLon: ${longitude.toFixed(6)}`;
  } catch (error) {
    console.error('Error getting address from Google:', error);
    // Fallback: return coordinates on error
    return `Lat: ${latitude.toFixed(6)}\nLon: ${longitude.toFixed(6)}`;
  }
};

  // Live on-screen overlay of timestamp + optional location
  useEffect(() => {
    let timer;
    let mounted = true;
    
    const tick = async () => {
      const ts = formatTimestamp(new Date());
      
      if (!settings.locationEnabled || !hasLocationPermission) {
        if (mounted) setLiveStamp(ts);
        return;
      }
      
      try {
        Geolocation.getCurrentPosition(
          async (pos) => {
            if (!mounted) return;
            
            const { latitude, longitude } = pos.coords;
            setCurrentLocation({ latitude, longitude });
            
            // Get address information
            const addressText = await getAddressFromCoordinates(latitude, longitude);
            setAddress(addressText);
            
            // Update the live stamp with location and address
            const locationText = `Lat: ${latitude.toFixed(6)}\nLon: ${longitude.toFixed(6)}`;
            const fullText = `${ts}\n${locationText}${addressText ? `\n${addressText}` : ''}`;
            setLiveStamp(fullText);
          },
          (error) => {
            console.error('Location error:', error);
            if (mounted) setLiveStamp(ts);
            
            // If permission error, prompt user to enable location
            if (error.code === error.PERMISSION_DENIED) {
              setHasLocationPermission(false);
            }
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );
      } catch (error) {
        console.error('Error getting location:', error);
        if (mounted) setLiveStamp(ts);
      }
    };
    
    tick();
    timer = setInterval(tick, 15000); // Update every 15 seconds to avoid too many requests
    
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [settings.locationEnabled, hasLocationPermission]);

  // Request all permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        if (!hasPermission) await requestPermission();
        if (!micPermission.hasPermission) await micPermission.requestPermission();
        
        // Request gallery permissions for Android
        if (Platform.OS === 'android') {
          try {
            if (Platform.Version >= 33) {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
              );
              setHasGalleryPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
            } else {
              const grants = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
              ]);
              setHasGalleryPermission(
                grants[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
                grants[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
              );
            }
          } catch (err) {
            console.error('Permission error:', err);
          }
        } else {
          // For iOS, we'll assume permission is granted for now
          setHasGalleryPermission(true);
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
      }
    };
    
    requestPermissions();
  }, [hasPermission, requestPermission, micPermission]);

  const onToggleCamera = useCallback(() => setFront(v => !v), []);

  const getLocationString = () => {
    if (!settings.locationEnabled || !currentLocation) return '';
    return `Lat: ${currentLocation.latitude.toFixed(6)}\nLon: ${currentLocation.longitude.toFixed(6)}${address ? `\n${address}` : ''}`;
  };

  const targetBitRate = useMemo(() => {
    switch (settings.resolution) {
      case '720p': return 4_000_000;
      case '4k': return 35_000_000;
      default: return 8_000_000;
    }
  }, [settings.resolution]);

  // Alternative method to save to gallery without CameraRoll
  const saveToGallery = async (filePath) => {
    try {
      if (Platform.OS === 'android' && !hasGalleryPermission) {
        Alert.alert(
          'Permission needed', 
          'Please grant gallery permissions in settings to save videos to your gallery',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
      
      // For Android, we need to trigger a media scan to make the video appear in gallery
      if (Platform.OS === 'android') {
        try {
          // This will make the video appear in the gallery
          await RNFS.scanFile(filePath);
          console.log('Video scanned and should appear in gallery');
          return true;
        } catch (scanError) {
          console.error('Error scanning file:', scanError);
          return false;
        }
      } else {
        // For iOS, we'll just return true as we can't easily save to gallery without CameraRoll
        return true;
      }
    } catch (error) {
      console.error('Failed to save to gallery:', error);
      return false;
    }
  };

  const startStopRecording = useCallback(async () => {
    if (!cameraRef.current || !device) return;
    
    if (recording) {
      cameraRef.current.stopRecording();
      return;
    }

    // Check if location is enabled but permission not granted
    if (settings.locationEnabled && !hasLocationPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Location Permission Required',
          'Location tagging is enabled but permission is not granted. Please enable location permissions in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
    }

    setStatusText('Recording...');
    setRecording(true);

    try {
      cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          setStatusText('Processing...');
          const timestamp = Date.now();
          const outPath = `${VIDEO_DIR}/VID_${timestamp}.mp4`;

          try {
            // Check if source file exists
            const sourceExists = await RNFS.exists(video.path);
            if (!sourceExists) {
              throw new Error(`Source file doesn't exist: ${video.path}`);
            }

            // Ensure destination directory exists
            const dirExists = await RNFS.exists(VIDEO_DIR);
            if (!dirExists) {
              await RNFS.mkdir(VIDEO_DIR);
            }

            // First, copy the file to our app directory
            await RNFS.copyFile(video.path, outPath);
            
            // Try to delete the original file
            try {
              await RNFS.unlink(video.path);
            } catch (deleteError) {
              console.warn('Could not delete original file:', deleteError);
            }
            
            // Then try to save to gallery
            const savedToGallery = await saveToGallery(outPath);
            
            if (savedToGallery) {
              setStatusText('Saved to gallery');
            } else {
              setStatusText('Saved to app only');
            }
            
            // Store reference to the video in app storage
            await AsyncStorage.setItem('lastSavedVideo', outPath);
            
            // If location is enabled, store location data with the video
            if (settings.locationEnabled && currentLocation) {
              const videoData = {
                path: outPath,
                location: {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  address: address
                },
                timestamp: new Date().toISOString(),
                resolution: settings.resolution
              };
              await AsyncStorage.setItem(`video_${timestamp}`, JSON.stringify(videoData));
            }
            
            fakePushApi(outPath);
          } catch (error) {
            console.error('Error processing video:', error);
            setStatusText('Error saving video');
          }
          
          setTimeout(() => setStatusText(''), 1500);
          setRecording(false);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setRecording(false);
          setStatusText('Recording failed');
          setTimeout(() => setStatusText(''), 1500);
        },
        fileType: 'mp4',
      });
    } catch (e) {
      console.error('Start recording error:', e);
      setRecording(false);
      setStatusText('Error');
      setTimeout(() => setStatusText(''), 1500);
    }
  }, [device, recording, settings, hasGalleryPermission, currentLocation, hasLocationPermission, address]);

  // Show permission request if needed
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Waiting for camera permission...</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>Camera device not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          video={true}
          audio={true}
        />
      )}
      <View style={styles.badges}>
        <Text style={styles.badge}>{settings.resolution}</Text>
        <Text style={[styles.badge, settings.locationEnabled ? styles.badgeOn : styles.badgeOff]}>
          {locationBadge}
        </Text>
        {settings.locationEnabled && !hasLocationPermission && (
          <TouchableOpacity onPress={requestLocationPermission} style={[styles.badge, styles.badgeWarning]}>
            <Text style={styles.badge}>Grant Location</Text>
          </TouchableOpacity>
        )}
      </View>
      {statusText ? <View style={styles.status}><Text style={styles.statusText}>{statusText}</Text></View> : null}
      {/* Live preview overlay (not burned in) */}
      <View pointerEvents="none" style={styles.overlayBox}>
        <Text style={styles.overlayText}>{liveStamp}</Text>
      </View>
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={startStopRecording} style={[styles.shutter, recording && styles.shutterRec]} />
        <TouchableOpacity onPress={onToggleCamera} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>Switch</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function fakePushApi(path) {
  // Dummy API push
  setTimeout(() => {
    console.log('Pushed to API:', path);
  }, 300);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  permissionButton: { marginTop: 20, padding: 15, backgroundColor: '#007AFF', borderRadius: 10 },
  permissionButtonText: { color: 'white', fontWeight: 'bold' },
  bottomBar: { position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'white', borderWidth: 6, borderColor: '#ddd' },
  shutterRec: { backgroundColor: '#ff3b30' },
  smallBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#00000088', borderRadius: 12 },
  smallBtnText: { color: 'white' },
  badges: { position: 'absolute', top: 24, left: 24, right: 24, flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  badge: { color: 'white', backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeOn: { backgroundColor: '#0a840a99' },
  badgeOff: { backgroundColor: '#840a0a99' },
  badgeWarning: { backgroundColor: '#ff9500' },
  status: { position: 'absolute', top: 24, alignSelf: 'center', backgroundColor: '#000000bb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { color: 'white' },
  overlayBox: { position: 'absolute', bottom: 110, right: 16, backgroundColor: '#00000088', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '80%' },
  overlayText: { color: 'white', fontSize: 14 },
});