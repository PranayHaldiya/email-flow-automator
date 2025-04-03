
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

/**
 * Authentication modal with login and registration tabs
 * @param {Function} onAuthSuccess - Callback function after successful authentication
 */
const AuthModal = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
  const [activeTab, setActiveTab] = useState<string>('login');

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Email Sequence Builder</h2>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm onSuccess={onAuthSuccess} />
        </TabsContent>
        <TabsContent value="register">
          <RegisterForm onSuccess={() => setActiveTab('login')} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuthModal;
