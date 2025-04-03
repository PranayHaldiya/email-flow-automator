/**
 * API service for making requests to the backend
 */

// Get the API URL based on the environment
const getApiUrl = () => {
  // If a specific API URL is set in environment variables, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production (like Vercel), use the same origin for API calls
  if (import.meta.env.PROD) {
    return '';  // Empty string means use the same origin
  }
  
  // Default to localhost for development
  return 'http://localhost:5000';
};

const API_URL = getApiUrl();

/**
 * Make a request to the API
 * @param endpoint - The API endpoint to call
 * @param options - The fetch options
 * @returns The response data
 */
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  try {
    // Set default headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Get the auth token if it exists
    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Make the request
    const url = API_URL ? `${API_URL}${endpoint}` : endpoint;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle network errors
    if (!response) {
      throw new Error("Network error: Could not connect to the server");
    }

    // Parse the response
    const data = await response.json();

    // Handle API errors
    if (!response.ok) {
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("API request error:", error);
    
    // Rethrow the error for the caller to handle
    throw error;
  }
};

/**
 * API authentication endpoints
 */
export const authApi = {
  /**
   * Register a new user
   * @param name - The user's name
   * @param email - The user's email
   * @param password - The user's password
   * @returns The registration response
   */
  register: async (name: string, email: string, password: string) => {
    return apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  /**
   * Login a user
   * @param email - The user's email
   * @param password - The user's password
   * @returns The login response with auth token
   */
  login: async (email: string, password: string) => {
    return apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Check if the API server is running
   * @returns The health check response
   */
  checkHealth: async () => {
    return apiRequest('/api/health');
  }
};

/**
 * Flow types
 */
export interface FlowNode {
  id: string;
  type?: string;  // Make type optional to match ReactFlow's Node type
  position: { x: number; y: number };
  data: any;
  [key: string]: any;  // Allow additional properties from ReactFlow's Node type
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  [key: string]: any;  // Allow additional properties from ReactFlow's Edge type
}

export interface FlowData {
  id?: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FlowSummary {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API flow management endpoints
 */
export const flowsApi = {
  /**
   * Save a new flow
   * @param flow - The flow data to save
   * @returns The saved flow response
   */
  saveFlow: async (flow: FlowData) => {
    return apiRequest('/api/flows', {
      method: 'POST',
      body: JSON.stringify(flow),
    });
  },

  /**
   * Update an existing flow
   * @param id - The ID of the flow to update
   * @param flow - The updated flow data
   * @returns The updated flow response
   */
  updateFlow: async (id: string, flow: Partial<FlowData>) => {
    return apiRequest(`/api/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(flow),
    });
  },

  /**
   * Get all flows for the current user
   * @returns List of flow summaries
   */
  getAllFlows: async () => {
    return apiRequest('/api/flows');
  },

  /**
   * Get a specific flow by ID
   * @param id - The ID of the flow to retrieve
   * @returns The flow data
   */
  getFlow: async (id: string) => {
    return apiRequest(`/api/flows/${id}`);
  },

  /**
   * Delete a flow
   * @param id - The ID of the flow to delete
   * @returns The deletion confirmation
   */
  deleteFlow: async (id: string) => {
    return apiRequest(`/api/flows/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Email template interface definitions
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateSummary {
  id: string;
  name: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API email template management endpoints
 */
export const templatesApi = {
  /**
   * Create a new email template
   * @param template - Template data to save
   * @returns The saved template response
   */
  createTemplate: async (template: { name: string; subject: string; body: string }) => {
    return apiRequest('/api/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  },

  /**
   * Get all email templates for the current user
   * @returns List of template summaries
   */
  getAllTemplates: async () => {
    return apiRequest('/api/templates');
  },

  /**
   * Get a specific email template by ID
   * @param id - The ID of the template to retrieve
   * @returns The template data
   */
  getTemplate: async (id: string) => {
    return apiRequest(`/api/templates/${id}`);
  },

  /**
   * Delete an email template
   * @param id - The ID of the template to delete
   * @returns The deletion confirmation
   */
  deleteTemplate: async (id: string) => {
    return apiRequest(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  },
};

export default {
  apiRequest,
  auth: authApi,
  flows: flowsApi,
  templates: templatesApi,
};
