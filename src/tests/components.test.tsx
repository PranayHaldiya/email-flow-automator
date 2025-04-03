
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import ColdEmailNode from '../components/nodes/ColdEmailNode';
import NodeConfiguration from '../components/NodeConfiguration';

// Mock the fetch API
global.fetch = jest.fn();

// Mock Toast component
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

describe('Authentication Components', () => {
  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
  });

  test('LoginForm renders correctly', () => {
    render(<LoginForm onSuccess={() => {}} />);
    
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  test('LoginForm handles submission', async () => {
    const mockOnSuccess = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-token', user: { id: '123', email: 'test@example.com' } })
    });
    
    render(<LoginForm onSuccess={mockOnSuccess} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  test('RegisterForm renders correctly', () => {
    render(<RegisterForm onSuccess={() => {}} />);
    
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
  });
});

describe('Node Components', () => {
  test('ColdEmailNode renders correctly', () => {
    const mockData = {
      label: 'Test Email',
      subject: 'Test Subject',
      body: 'Test Body',
      recipient: 'test@example.com'
    };
    
    render(<ColdEmailNode data={mockData} isConnectable={true} />);
    
    expect(screen.getByText('Test Email')).toBeInTheDocument();
    expect(screen.getByText(/Subject: Test Subject/i)).toBeInTheDocument();
  });

  test('NodeConfiguration updates on input change', () => {
    const mockNode = {
      id: 'test-node',
      type: 'coldEmail',
      position: { x: 0, y: 0 },
      data: {
        label: 'Test Email',
        subject: 'Original Subject',
        body: 'Original Body',
        recipient: 'original@example.com'
      }
    };
    
    const mockUpdate = jest.fn();
    const mockClose = jest.fn();
    
    render(<NodeConfiguration node={mockNode} onUpdate={mockUpdate} onClose={mockClose} />);
    
    // Change label input
    fireEvent.change(screen.getByLabelText(/Node Label/i), { target: { value: 'Updated Label' } });
    expect(mockUpdate).toHaveBeenCalledWith({ label: 'Updated Label' });
    
    // Change subject input
    fireEvent.change(screen.getByLabelText(/Email Subject/i), { target: { value: 'Updated Subject' } });
    expect(mockUpdate).toHaveBeenCalledWith({ subject: 'Updated Subject' });
  });
});
