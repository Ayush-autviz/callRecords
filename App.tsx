import React, { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, PERMISSIONS, RESULTS, check, Permission } from 'react-native-permissions';

import Recordings from "./src/screens/Recordings";
import Auth from "./src/screens/Auth";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await checkLoginStatus();
    await requestNotificationPermission();
  };

  const requestNotificationPermission = async () => {
    try {
      console.log('[App] Requesting notification permission...');
      
      if (Platform.OS === 'ios') {
        // For iOS, notifications are handled differently
        // We'll assume permission is granted for background services
        console.log('[App] iOS - notification permission assumed granted for background services');
        setNotificationPermissionGranted(true);
        return;
      } else {
        // For Android 13+ (API 33+), request POST_NOTIFICATIONS permission
        if (Number(Platform.Version) >= 33) {
          const permission = 'android.permission.POST_NOTIFICATIONS' as Permission;
          
          // Check current permission status
          const currentStatus = await check(permission);
          console.log('[App] Current notification permission status:', currentStatus);

          if (currentStatus === RESULTS.GRANTED) {
            console.log('[App] Notification permission already granted');
            setNotificationPermissionGranted(true);
            return;
          }

          if (currentStatus === RESULTS.DENIED) {
            // Request permission
            const result = await request(permission);
            console.log('[App] Notification permission request result:', result);
            
            if (result === RESULTS.GRANTED) {
              console.log('[App] Notification permission granted');
              setNotificationPermissionGranted(true);
            } else if (result === RESULTS.DENIED) {
              console.log('[App] Notification permission denied');
              setNotificationPermissionGranted(false);
              showNotificationPermissionAlert();
            } else if (result === RESULTS.BLOCKED) {
              console.log('[App] Notification permission blocked');
              setNotificationPermissionGranted(false);
              showNotificationPermissionAlert(true);
            }
          } else if (currentStatus === RESULTS.BLOCKED) {
            console.log('[App] Notification permission is blocked');
            setNotificationPermissionGranted(false);
            showNotificationPermissionAlert(true);
          } else {
            console.log('[App] Notification permission unavailable on this device');
            setNotificationPermissionGranted(false);
          }
        } else {
          // For older Android versions, notifications are granted by default
          console.log('[App] Android version < 33, notifications granted by default');
          setNotificationPermissionGranted(true);
        }
      }
    } catch (error) {
      console.error('[App] Error requesting notification permission:', error);
      setNotificationPermissionGranted(false);
    }
  };

  const showNotificationPermissionAlert = (isBlocked = false) => {
    const title = isBlocked ? 'Notification Permission Blocked' : 'Notification Permission Required';
    const message = isBlocked 
      ? 'Notifications are blocked for this app. Please enable them in Settings > Apps > CallRecords > Notifications to receive background service updates.'
      : 'This app needs notification permission to show background service status updates. Please grant permission to continue.';

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            console.log('[App] User cancelled notification permission');
          }
        },
        {
          text: isBlocked ? 'Open Settings' : 'Grant Permission',
          onPress: () => {
            if (isBlocked) {
              console.log('[App] User wants to open settings');
            } else {
              // Retry permission request
              requestNotificationPermission();
            }
          }
        }
      ]
    );
  };

  const checkLoginStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        // User is logged in
        const parsedData = JSON.parse(userData);
        console.log('User logged in:', parsedData);
        setIsLoggedIn(true);
      } else {
        // User is not logged in
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  // Show loading indicator while checking login status and permissions
  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white'
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Render appropriate screen based on login status
  return isLoggedIn ? 
    <Recordings onLogout={handleLogout} /> : 
    <Auth onLoginSuccess={handleLoginSuccess} />;
}