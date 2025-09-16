import axios from 'axios';

// API Configuration
const API_BASE_URL = 'https://api.zopoxo.com/api/services/app/ExportProductService';

// Types for the API call
export interface CallRecordingData {
  tenantId: number;
  email: string;
  file: {
    uri: string;
    type: string;
    name: string;
  };
  type: string;
  phoneNumber: string;
  callDatetime: string;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Upload call recording to the server
 * @param callData - The call recording data to upload
 * @param authToken - Optional authorization token
 * @param xsrfToken - XSRF token for CSRF protection
 * @returns Promise<ApiResponse>
 */
export const uploadCallRecording = async (
  callData: CallRecordingData,
  authToken?: string,
  xsrfToken?: string
): Promise<ApiResponse> => {
  try {
    console.log('[API] Starting call recording upload...', {
      tenantId: callData.tenantId,
      email: callData.email,
      phoneNumber: callData.phoneNumber,
      type: callData.type,
      callDatetime: callData.callDatetime
    });

    // Create FormData for multipart/form-data request
    const formData = new FormData();
    
    // Append all the required fields
    formData.append('TenantId', callData.tenantId.toString());
    formData.append('Email', callData.email);
    formData.append('Type', callData.type);
    formData.append('PhoneNumber', callData.phoneNumber);
    formData.append('CallDatetime', callData.callDatetime);
    
    // Append the file
    formData.append('file', {
      uri: callData.file.uri,
      type: callData.file.type,
      name: callData.file.name,
    } as any);

    // Prepare headers
    const headers: any = {
      'accept': '*/*',
      'Content-Type': 'multipart/form-data',
    };

    // Add authorization header if provided
    if (authToken) {
      headers['Authorization'] = authToken;
    } else {
      headers['Authorization'] = 'null';
    }

    // Add XSRF token if provided
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    // Make the API call
    const response = await axios.post(
      `${API_BASE_URL}/InsertCallRecordings`,
      formData,
      {
        headers,
        timeout: 30000, // 30 seconds timeout
      }
    );

    console.log('[API] Call recording upload successful:', response.status);
    
    return {
      success: true,
      data: response.data,
    };

  } catch (error: any) {
    console.error('[API] Call recording upload failed:', error);
    
    // Handle different types of errors
    let errorMessage = 'Unknown error occurred';
    
    if (error.response) {
      // Server responded with error status
      errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = 'Network error: No response from server';
    } else {
      // Something else happened
      errorMessage = error.message || 'Request setup error';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};


/**
 * Helper function to format datetime for API
 * @param date - Date object or string
 * @returns Formatted datetime string
 */
export const formatCallDatetime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0]; // Format: YYYY-MM-DD
};

// Example usage:
/*
import { uploadCallRecording, formatCallDatetime } from './api';

// Example 2: Direct usage
const directResult = await uploadCallRecording({
  tenantId: 255,
  email: 'test@gmail.com',
  file: {
    uri: 'file:///path/to/recording.mp3',
    type: 'audio/mpeg',
    name: 'recording.mp3'
  },
  type: 'abandoned',
  phoneNumber: '987367645',
  callDatetime: '2025-07-23'
});
*/
