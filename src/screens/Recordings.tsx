import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Button,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import RNFS from "react-native-fs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { uploadCallRecording } from "../helper/api";
import BackgroundService from 'react-native-background-actions';

const DEFAULT_FOLDER = "/storage/emulated/0/Recordings/Call/"; // Fallback folder
const LAST_RECORDING_TIMESTAMP_KEY = 'lastRecordingTimestamp';
const USER_DATA_KEY = 'userData';
const BACKGROUND_SERVICE_RUNNING_KEY = 'backgroundServiceRunning';

// Types
interface UserData {
  email: string;
  role: string;
  tenantId?: number;
  folderPath?: string;
  type?: string;
}

interface RecordingFile {
  name: string;
  path: string;
  mtime: Date | number | null;
  size: number;
  isFile: () => boolean;
  isDirectory: () => boolean;
}

// Background service options
const options = {
  taskName: 'RecordingUploader',
  taskTitle: 'Recording Upload Service',
  taskDesc: 'Uploading call recordings in background',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#ff00ff',
  parameters: {
    delay: 5000, // Check every 5 seconds
  },
};

const sleep = (time: number): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), time));

// Helper to retrieve the last recording timestamp
const getLastRecordingTimestamp = async (): Promise<number> => {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_RECORDING_TIMESTAMP_KEY);
    if (timestamp) {
      return parseInt(timestamp, 10);
    } else {
      const currentTime = Date.now();
      await setLastRecordingTimestamp(currentTime);
      return currentTime;
    }
  } catch (error) {
    console.error('Error getting last recording timestamp:', error);
    return Date.now();
  }
};

// Helper to update the last recording timestamp
const setLastRecordingTimestamp = async (timestamp: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_RECORDING_TIMESTAMP_KEY, timestamp.toString());
  } catch (error) {
    console.error('Error setting last recording timestamp:', error);
  }
};

// Helper to get background service running state
const getBackgroundServiceRunning = async (): Promise<boolean> => {
  try {
    const state = await AsyncStorage.getItem(BACKGROUND_SERVICE_RUNNING_KEY);
    return state === 'true';
  } catch (error) {
    console.error('Error getting background service running state:', error);
    return false;
  }
};

// Helper to set background service running state
const setBackgroundServiceRunning = async (isRunning: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(BACKGROUND_SERVICE_RUNNING_KEY, isRunning.toString());
  } catch (error) {
    console.error('Error setting background service running state:', error);
  }
};

export default function Recordings({ onLogout }: { onLogout: () => void }) {
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [isBackgroundServiceRunning, setIsBackgroundServiceRunning] = useState(false);

  const cleanNumber = (number: string) => {
    if (number.startsWith('+91')) {
      return number.slice(3);
    } else if (number.startsWith('91')) {
      return number.slice(2);
    }
    else if (number.startsWith('0')) {
      return number.slice(1);
    }
    return number;
  }

  // 🔹 Request storage permission
  const requestPermission = async (): Promise<void> => {
    if (Platform.OS === "android") {
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
        );
      } else {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
      }
    }
  };

  // Send recording to API
  const sendRecordingToAPI = async (recording: RecordingFile): Promise<void> => {
    try {
      console.log('[BackgroundService] Sending recording to API:', recording.name);
      
      if (!userData) {
        console.log('[BackgroundService] No user data found, skipping upload');
        return;
      }

      // Create call data for API
      const callData = {
        tenantId: userData.tenantId || 0,
        email: userData.email,
        file: {
          uri: `file://${recording.path}`,
          type: 'audio/mpeg',
          name: recording.name
        },
        type: userData.type || 'unknown',
        phoneNumber: cleanNumber(recording.name.split('_')[0].split(' ')[2]),
        callDatetime: recording.mtime ? new Date(recording.mtime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      };

      console.log('[BackgroundService] Call data created:', callData);

      // Upload the recording
      const result = await uploadCallRecording(
        callData,             
      );

      if (result.success) {
        console.log('[BackgroundService] Recording uploaded successfully:', recording.name);
        if (recording.mtime) {
          await setLastRecordingTimestamp(new Date(recording.mtime).getTime());
        }
      } else {
        console.error('[BackgroundService] Failed to upload recording:', result.error);
      }

    } catch (error) {
      console.error('[BackgroundService] Error sending recording to API:', error);
    }
  };

  // Parse date from Samsung filename
  const parseDateFromName = (name: string): Date | null => {
    const match = name.match(/_(\d{6})_(\d{6})/); // e.g. 211006_085843
    if (match) {
      const [_, yymmdd, hhmmss] = match;
      const year = 2000 + parseInt(yymmdd.slice(0, 2));
      const month = parseInt(yymmdd.slice(2, 4)) - 1;
      const day = parseInt(yymmdd.slice(4, 6));
      const hour = parseInt(hhmmss.slice(0, 2));
      const min = parseInt(hhmmss.slice(2, 4));
      const sec = parseInt(hhmmss.slice(4, 6));
      return new Date(year, month, day, hour, min, sec);
    }
    return null;
  };

  // Check for new recordings
  const checkForNewRecordings = async (): Promise<void> => {
    try {
      if (!userData) {
        console.log('[BackgroundService] No user data found');
        return;
      }

      const folderPath = userData.folderPath || DEFAULT_FOLDER;
      console.log('[BackgroundService] Checking folder:', folderPath);

      const folderExists = await RNFS.exists(folderPath);
      if (!folderExists) {
        console.log('[BackgroundService] Folder does not exist:', folderPath);
        return;
      }

      const files = await RNFS.readDir(folderPath);
      console.log('[BackgroundService] Found files:', files.length);

      const lastProcessedTimestamp = await getLastRecordingTimestamp();
      console.log('[BackgroundService] Last processed timestamp:', lastProcessedTimestamp);

      const audioFiles = files.filter(f => 
        f.isFile() && 
        (f.name.endsWith('.mp3') || f.name.endsWith('.m4a'))
      );

      const newRecordings: RecordingFile[] = [];
      for (const file of audioFiles) {
        try {
          const stat = await RNFS.stat(file.path);
          const fileTime = stat.mtime ? new Date(stat.mtime).getTime() : 
                          parseDateFromName(file.name) ? parseDateFromName(file.name)!.getTime() : 0;
          
          if (fileTime > lastProcessedTimestamp) {
            newRecordings.push({
              ...file,
              mtime: stat.mtime || parseDateFromName(file.name),
              size: stat.size || 0
            });
          }
        } catch (error) {
          console.error('[BackgroundService] Error getting file stats:', error);
        }
      }

      console.log('[BackgroundService] New recordings found:', newRecordings.length);

      for (const recording of newRecordings) {
        await sendRecordingToAPI(recording);
        await sleep(1000);
      }

    } catch (error) {
      console.error('[BackgroundService] Error checking for new recordings:', error);
    }
  };

  // Background task
  const backgroundRecordingTask = async (taskDataArguments: any): Promise<void> => {
    const { delay } = taskDataArguments;
    try {
      await new Promise(async (resolve) => {
        for (let i = 0; BackgroundService.isRunning(); i++) {
          await BackgroundService.updateNotification({
            taskDesc: `Recording Upload Service - Check ${i}`
          });
          
          console.log('[BackgroundService] Checking for new recordings...', i);
          await checkForNewRecordings();
          
          await sleep(delay);
        }
      });
    } catch (error) {
      console.error('[BackgroundService] Background task error:', error);
    }
  };

  const startBackgroundService = async (): Promise<void> => {
    try {
      await BackgroundService.start(backgroundRecordingTask, options);
      await BackgroundService.updateNotification({
        taskDesc: 'Recording Upload Service Started'
      });
      setIsBackgroundServiceRunning(true);
      await setBackgroundServiceRunning(true);
      console.log('[BackgroundService] Background service started');
      Alert.alert('Success', 'Background service started!');
    } catch (error) {
      console.error('[BackgroundService] Error starting background service:', error);
      Alert.alert('Error', 'Failed to start background service');
    }
  };

  const stopBackgroundService = async (): Promise<void> => {
    try {
      await BackgroundService.stop();
      setIsBackgroundServiceRunning(false);
      await setBackgroundServiceRunning(false);
      console.log('[BackgroundService] Background service stopped');
      Alert.alert('Success', 'Background service stopped!');
    } catch (error) {
      console.error('[BackgroundService] Error stopping background service:', error);
      Alert.alert('Error', 'Failed to stop background service');
    }
  };

  // 🔹 Handle logout
  const handleLogout = (): void => {
    Alert.alert(
      "Logout Confirmation",
      "Are you sure you want to logout? This will clear all your stored data and return you to the login screen.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // Stop background service before logout
              if (isBackgroundServiceRunning) {
                await stopBackgroundService();
              }
              // Clear all user data and service state
              await AsyncStorage.removeItem('userData');
              await AsyncStorage.removeItem(BACKGROUND_SERVICE_RUNNING_KEY);
              Alert.alert(
                "Logged Out",
                "You have been successfully logged out.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      if (onLogout) {
                        onLogout();
                      }
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error clearing storage:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          },
        },
      ]
    );
  };

  // 🔹 Get user data and folder path
  const getUserData = async (): Promise<string> => {
    try {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const parsedData = JSON.parse(data);
        setUserData(parsedData);
        const folderPath = parsedData.folderPath || DEFAULT_FOLDER;
        setFolder(folderPath);
        return folderPath;
      } else {
        setFolder(DEFAULT_FOLDER);
        return DEFAULT_FOLDER;
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      setFolder(DEFAULT_FOLDER);
      return DEFAULT_FOLDER;
    }
  };

  // 🔹 Fetch recordings with stats
  const fetchRecordings = async (path: string | null = folder): Promise<void> => {
    if (!path) return;
    
    setIsLoading(true);
    try {
      const files = await RNFS.readDir(path);

      const audioFiles = await Promise.all(
        files
          .filter(
            (f) =>
              f.isFile() &&
              (f.name.endsWith(".mp3") || f.name.endsWith(".m4a"))
          )
          .map(async (f) => {
            try {
              const stat = await RNFS.stat(f.path);
              return {
                ...f,
                mtime: stat.mtime || parseDateFromName(f.name),
                size: stat.size || 0,
              };
            } catch {
              return {
                ...f,
                mtime: parseDateFromName(f.name),
                size: 0,
              };
            }
          })
      );

      const sorted = audioFiles.sort((a, b) => {
        const at = a.mtime ? new Date(a.mtime).getTime() : 0;
        const bt = b.mtime ? new Date(b.mtime).getTime() : 0;
        return bt - at;
      });

      // Limit to only 10 recordings
      const limitedRecordings = sorted.slice(0, 10);
      setRecordings(limitedRecordings);
    } catch (e) {
      console.log("Error reading folder: ", e);
      setRecordings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      await requestPermission();
      await getUserData();
      // Initialize background service state from AsyncStorage
      const serviceState = await getBackgroundServiceRunning();
      setIsBackgroundServiceRunning(serviceState);
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (folder) fetchRecordings(folder);
  }, [folder]);

  // 🔹 Formatters
  const formatDate = (date: Date | number | null): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleString();
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: "white" }}>
      {/* Header with logout button */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "bold", flex: 1 }}>📞 Call Recordings</Text>
        <TouchableOpacity
          style={{
            backgroundColor: "#FF3B30",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
          }}
          onPress={handleLogout}
        >
          <Text style={{ color: "white", fontSize: 14, fontWeight: "600" }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {userData && (
        <Text style={{ fontSize: 14, color: "#666", marginBottom: 5 }}>
          Welcome, {userData.email} ({userData.role})
        </Text>
      )}
      <Text style={{ marginVertical: 5 }}>Folder: {folder}</Text>
      <Text style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
        Showing latest 10 recordings only
      </Text>
      
      {/* Button row */}
      <View style={{ flexDirection: "row", marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <Button 
          title={isLoading ? "Loading..." : "Refresh"} 
          onPress={() => fetchRecordings()} 
          disabled={isLoading}
          color="#007AFF"
        />
        <Button 
          title={isBackgroundServiceRunning ? "Stop Service" : "Start Service"} 
          onPress={isBackgroundServiceRunning ? stopBackgroundService : startBackgroundService} 
          color={isBackgroundServiceRunning ? "#FF3B30" : "#28A745"}
        />
      </View>

      {/* Background Service Status */}
      <View style={{ 
        backgroundColor: isBackgroundServiceRunning ? '#d4edda' : '#f8d7da', 
        padding: 10, 
        borderRadius: 5, 
        marginBottom: 10 
      }}>
        <Text style={{ 
          color: isBackgroundServiceRunning ? '#155724' : '#721c24', 
          textAlign: 'center', 
          fontWeight: 'bold' 
        }}>
          Background Service: {isBackgroundServiceRunning ? 'Running' : 'Stopped'}
        </Text>
        <Text style={{ 
          color: isBackgroundServiceRunning ? '#155724' : '#721c24', 
          textAlign: 'center', 
          fontSize: 12 
        }}>
          {isBackgroundServiceRunning ? 'Monitoring for new recordings every 5 seconds' : 'Service is not running'}
        </Text>
      </View>

      {/* Show loading indicator or recordings list */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 10, color: '#666' }}>Loading recordings...</Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <View   
              style={{
                paddingVertical: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: "#ccc",
              }}
            >
              <Text style={{ fontWeight: "600" }}>{item.name}</Text>
              <Text style={{ fontSize: 12, color: "gray" }}>
                {formatDate(item.mtime)} • {formatSize(item.size)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
              <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
                No recordings found in this folder.{'\n'}
                Check if the folder path is correct or try refreshing.{'\n\n'}
                <Text style={{ fontSize: 14, color: '#999' }}>
                  Showing latest 10 recordings only.
                </Text>
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}