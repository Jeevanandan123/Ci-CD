import React, { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CameraScreen from './CameraScreen';
import SettingsScreen from './SettingsScreen';
import RNFS from 'react-native-fs';

const Stack = createNativeStackNavigator();

export const VIDEO_DIR = `${RNFS.ExternalStorageDirectoryPath ?? RNFS.DocumentDirectoryPath}/CameraAppVideos`;

async function ensureVideoDirExists() {
  try {
    const exists = await RNFS.exists(VIDEO_DIR);
    if (!exists) {
      await RNFS.mkdir(VIDEO_DIR);
    }
  } catch (e) {
    // noop
  }
}

async function autoDeleteOldVideos() {
  try {
    const daysStr = await AsyncStorage.getItem('autoDeleteDays');
    const days = daysStr ? parseInt(daysStr, 10) : 0;
    if (!days || days <= 0) return;
    const files = await RNFS.readDir(VIDEO_DIR);
    const now = Date.now();
    const cutoff = days * 24 * 60 * 60 * 1000;
    await Promise.all(
      files
        .filter(f => f.isFile() && f.name.endsWith('.mp4'))
        .map(async f => {
          const age = now - (f.mtime?.getTime?.() ?? now);
          if (age > cutoff) {
            try { await RNFS.unlink(f.path); } catch {}
          }
        }),
    );
  } catch {}
}

function App() {
  useEffect(() => {
    ensureVideoDirExists();
    autoDeleteOldVideos();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={'light-content'} />
      <NavigationContainer theme={DefaultTheme}>
        <Stack.Navigator>
          <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default App;
