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


const DEFAULT_FOLDER = "/storage/emulated/0/Recordings/Call/"; // Fallback folder

export default function Recordings({ onLogout }) {
  const [recordings, setRecordings] = useState([]);
  const [folder, setFolder] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🔹 Request storage permission
  const requestPermission = async () => {
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

  // 🔹 Handle logout
  const handleLogout = () => {
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
              await AsyncStorage.removeItem('userData');
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
  const getUserData = async () => {
    try {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const parsedData = JSON.parse(data);
        setUserData(parsedData);
        // Use folder path from user data, fallback to DEFAULT_FOLDER
        const folderPath = parsedData.folderPath || DEFAULT_FOLDER;
        setFolder(folderPath);
        return folderPath;
      } else {
        // No user data, use default folder
        setFolder(DEFAULT_FOLDER);
        return DEFAULT_FOLDER;
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      setFolder(DEFAULT_FOLDER);
      return DEFAULT_FOLDER;
    }
  };

  // 🔹 Parse date from Samsung filename
  const parseDateFromName = (name) => {
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

  // 🔹 Fetch recordings with stats
  const fetchRecordings = async (path = folder) => {
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

      // Sort by mtime (newest first)
      const sorted = audioFiles.sort((a, b) => {
        const at = a.mtime ? new Date(a.mtime).getTime() : 0;
        const bt = b.mtime ? new Date(b.mtime).getTime() : 0;
        return bt - at;
      });

      setRecordings(sorted);
    } catch (e) {
      console.log("Error reading folder: ", e);
      setRecordings([]); // Clear recordings on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      await requestPermission();
      await getUserData();
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (folder) fetchRecordings(folder);
  }, [folder]);

  // 🔹 Formatters
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleString();
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "white" }}>
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
      <Button 
        title={isLoading ? "Loading..." : "Refresh"} 
        onPress={() => fetchRecordings()} 
        disabled={isLoading}
        color="#007AFF"
      />

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
                Check if the folder path is correct or try refreshing.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
