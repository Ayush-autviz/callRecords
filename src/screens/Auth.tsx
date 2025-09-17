import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  Modal,
  FlatList,
  PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Auth({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [folderPath, setFolderPath] = useState('/storage/emulated/0/Recordings/Call/');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [currentPath, setCurrentPath] = useState('/storage/emulated/0/');
  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);

  const roles = [
    { label: 'Select a type...', value: '' },
    { label: 'abondoned', value: 'abondoned' },
    { label: 'order confirmation', value: 'order confirmation' },
    // { label: 'Manager', value: 'manager' },
  ];

  const tenantOptions = [
    { label: 'Select tenant...', value: '' },
    { label: "wormily's", value: '255' },
    { label: 'Younger bright', value: '443' },
  ];

  // Request storage permission for folder browsing
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  // Load folder contents
  const loadFolderContents = async (path: string) => {
    setIsLoading(true);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Storage permission is required to browse folders');
        setIsLoading(false);
        return;
      }

      const items = await RNFS.readDir(path);
      
      // Separate directories and files, sort directories first
      const directories = items
        .filter(item => !item.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));
      
      const files = items
        .filter(item => item.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));

      setFolderContents([...directories, ...files]);
      setCurrentPath(path);
    } catch (error) {
      console.error('Error loading folder contents:', error);
      Alert.alert('Error', 'Unable to access this folder');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to parent directory
  const goToParentDirectory = () => {
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    if (parentPath !== currentPath && parentPath !== '') {
      loadFolderContents(parentPath);
    }
  };

  // Handle folder selection
  const selectFolder = (item: any) => {
    if (item.isFile()) {
      // Don't allow selecting files, only folders
      return;
    }
    
    const newPath = item.path;
    setFolderPath(newPath);
    setShowFolderPicker(false);
  };

  // Open folder picker
  const openFolderPicker = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Storage permission is required to browse folders');
      return;
    }
    
    setShowFolderPicker(true);
    loadFolderContents(currentPath);
  };

  // Initialize folder picker with default path
  useEffect(() => {
    if (showFolderPicker) {
      loadFolderContents(currentPath);
    }
  }, [showFolderPicker]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!tenantId.trim()) {
      Alert.alert('Error', 'Please enter your tenant id');
      return;
    }
    
    if (!selectedRole) {
      Alert.alert('Error', 'Please select a type');
      return;
    }

    if (!folderPath.trim()) {
      Alert.alert('Error', 'Please enter a folder path');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      // Store user data in AsyncStorage
      const userData = {
        email: email.trim(),
        tenantId: tenantId.trim(),
        type: selectedRole,
        folderPath: folderPath.trim(),
        loginTime: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      Alert.alert(
        'Success',
        `Welcome! You are logged in.`,
        [{ text: 'OK' }]
      );
      
      // Notify parent component about successful login
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      
    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Error', 'Failed to save login data. Please try again.');
    }
  };

  const selectRole = (role: any) => {
    setSelectedRole(role.value);
    setShowDropdown(false);
  };

  const selectTenant = (tenant: any) => {
    setTenantId(tenant.value);
    setShowTenantDropdown(false);
  };

  const getSelectedRoleLabel = () => {
    const role = roles.find(r => r.value === selectedRole);
    return role ? role.label : 'Select a role...';
  };

  const getSelectedTenantLabel = () => {
    const tenant = tenantOptions.find(t => t.value === tenantId);
    return tenant ? tenant.label : 'Select tenant ID...';
  };

  const renderFolderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.folderItem,
        item.isFile() && styles.fileItem,
      ]}
      onPress={() => item.isFile() ? null : loadFolderContents(item.path)}
      disabled={item.isFile()}
    >
      <Text style={styles.folderIcon}>
        {item.isFile() ? '📄' : '📁'}
      </Text>
      <Text style={styles.folderName} numberOfLines={1}>
        {item.name}
      </Text>
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => selectFolder(item)}
        disabled={item.isFile()}
      >
        <Text style={[styles.selectButtonText, item.isFile() && styles.disabledText]}>
          Select
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🔐 Authentication</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.emailInput}
          placeholder="Enter your email"
          placeholderTextColor="gray"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Tenant</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowTenantDropdown(true)}
        >
          <Text style={styles.dropdownText}>{getSelectedTenantLabel()}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Select Type</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowDropdown(true)}
        >
          <Text style={styles.dropdownText}>{getSelectedRoleLabel()}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Call Recordings Folder Path</Text>
        <View style={styles.folderInputContainer}>
          <TextInput
            style={styles.folderInput}
            placeholder="Enter folder path or browse to select"
            placeholderTextColor="gray"
            value={folderPath}
            onChangeText={setFolderPath}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.browseButton}
            onPress={openFolderPicker}
          >
            <Text style={styles.browseButtonText}>Browse</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>
          Default: /storage/emulated/0/Recordings/Call/
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Sign In"
          onPress={handleSubmit}
          color="#007AFF"
        />
      </View>

      {/* Role Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            <FlatList
              data={roles}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedRole === item.value && styles.selectedItem,
                  ]}
                  onPress={() => selectRole(item)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedRole === item.value && styles.selectedItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tenant ID Dropdown Modal */}
      <Modal
        visible={showTenantDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTenantDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTenantDropdown(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Tenant ID</Text>
            <FlatList
              data={tenantOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    tenantId === item.value && styles.selectedModalItem
                  ]}
                  onPress={() => selectTenant(item)}
                >
                  <Text style={[
                    styles.modalItemText,
                    tenantId === item.value && styles.selectedModalItemText
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Folder Picker Modal */}
      <Modal
        visible={showFolderPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFolderPicker(false)}
      >
        <View style={styles.folderPickerOverlay}>
          <View style={styles.folderPickerContainer}>
            <View style={styles.folderPickerHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={goToParentDirectory}
              >
                <Text style={styles.backButtonText}>⬅️ Back</Text>
              </TouchableOpacity>
              <Text style={styles.folderPickerTitle}>Select Folder</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFolderPicker(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.currentPathText} numberOfLines={1}>
              {currentPath}
            </Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text>Loading...</Text>
              </View>
            ) : (
              <FlatList
                data={folderContents}
                keyExtractor={(item) => item.path}
                renderItem={renderFolderItem}
                style={styles.folderList}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#666',
  },
  folderInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  folderInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  browseButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  browseButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    width: '80%',
    maxHeight: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItem: {
    backgroundColor: '#007AFF',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedItemText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  folderPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  folderPickerContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  folderPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  folderPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  currentPathText: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderList: {
    flex: 1,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fileItem: {
    opacity: 0.6,
  },
  folderIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  folderName: {
    flex: 1,
    fontSize: 16,
  },
  selectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledText: {
    color: '#ccc',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    width: '80%',
    maxHeight: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  modalItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedModalItem: {
    backgroundColor: '#e3f2fd',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedModalItemText: {
    color: '#1976d2',
    fontWeight: '600',
  },
});
