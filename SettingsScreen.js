import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resolutions = ['720p', '1080p', '4k', 'Auto'];

export default function SettingsScreen({ navigation }) {
  const [resolution, setResolution] = useState('1080p');
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [autoDeleteDays, setAutoDeleteDays] = useState('0');

  useEffect(() => {
    (async () => {
      const kv = await AsyncStorage.multiGet(['resolution', 'locationEnabled', 'autoDeleteDays']);
      kv.forEach(([k, v]) => {
        if (v == null) return;
        if (k === 'locationEnabled') setLocationEnabled(v === 'true');
        else if (k === 'resolution') setResolution(v);
        else if (k === 'autoDeleteDays') setAutoDeleteDays(v);
      });
    })();
  }, []);

  const save = async (next = {}) => {
    const payload = {
      resolution,
      locationEnabled: String(locationEnabled),
      autoDeleteDays,
      ...next,
    };
    await AsyncStorage.multiSet(Object.entries(payload));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Video Resolution</Text>
      <View style={styles.row}>
        {resolutions.map(r => (
          <TouchableOpacity 
            key={r} 
            onPress={async () => { 
              setResolution(r); 
              await save({ resolution: r }); 
            }} 
            style={[styles.chip, resolution === r && styles.chipActive]}
          >
            <Text style={[styles.chipText, resolution === r && styles.chipTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Location Tagging</Text>
        <Switch 
          value={locationEnabled} 
          onValueChange={async v => { 
            setLocationEnabled(v); 
            await save({ locationEnabled: String(v) }); 
          }} 
        />
      </View>

      <View style={{

          flexDirection: 'column', gap: 4, marginTop: 16
      }}>
        <Text style={styles.label}>Auto delete after N days (0 to disable)</Text>

        <View style={styles.row}>
          {['0','3','7','30'].map(n => (
            <TouchableOpacity 
              key={n} 
              onPress={async () => { 
                setAutoDeleteDays(n); 
                await save({ autoDeleteDays: n }); 
              }} 
              style={[styles.chip, autoDeleteDays === n && styles.chipActive]}
            >
              <Text style={[styles.chipText, autoDeleteDays === n && styles.chipTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        onPress={() => navigation.goBack()} 
        style={styles.saveBtn}
      >
        <Text style={styles.saveText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 16, color: '#222', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginVertical: 8 },
  switchRow: { 
    marginVertical: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
   switchRowAuto: { 
    marginVertical: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  chip: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#eee', 
    borderRadius: 12 
  },
  chipActive: { backgroundColor: '#333' },
  chipText: { color: '#111' },
  chipTextActive: { color: 'white' },
  saveBtn: { 
    marginTop: 24, 
    alignSelf: 'center', 
    backgroundColor: '#000', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12 
  },
  saveText: { color: 'white' },
});