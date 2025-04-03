import { Node } from 'reactflow';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
import EmailTemplateManager from './EmailTemplateManager';

interface NodeConfigurationProps {
  node: Node;
  onUpdate: (data: any) => void;
  onClose: () => void;
}

const NodeConfiguration = ({ node, onUpdate, onClose }: NodeConfigurationProps) => {
  // Create local state for form fields to enable controlled inputs
  const [formState, setFormState] = useState({ ...node.data });

  // Update local state when a node changes
  useEffect(() => {
    setFormState({ ...node.data });
  }, [node.id, node.data]);

  const handleChange = (field: string, value: any) => {
    // Update local state first
    setFormState(current => ({
      ...current,
      [field]: value
    }));

    // Then propagate changes to parent component
    onUpdate({ [field]: value });
  };

  // Handle template selection
  const handleTemplateSelection = (template: { subject: string; body: string }) => {
    // Update multiple fields at once
    setFormState(current => ({
      ...current,
      subject: template.subject,
      body: template.body
    }));

    // Propagate changes to parent component
    onUpdate({ 
      subject: template.subject,
      body: template.body
    });
  };

  const renderConfigFields = () => {
    switch (node.type) {
      case 'coldEmail':
        return (
          <>
            <EmailTemplateManager onSelectTemplate={handleTemplateSelection} />
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject
              </label>
              <Input
                type="text"
                value={formState.subject || ''}
                onChange={(e) => handleChange('subject', e.target.value)}
                className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient
              </label>
              <Input
                type="email"
                value={formState.recipient || ''}
                onChange={(e) => handleChange('recipient', e.target.value)}
                className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@example.com"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Body
              </label>
              <Textarea
                value={formState.body || ''}
                onChange={(e) => handleChange('body', e.target.value)}
                rows={5}
                className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </>
        );

      case 'waitDelay':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delay Duration
              </label>
              <div className="flex">
                <Input
                  type="number"
                  value={formState.delay || 1}
                  onChange={(e) => handleChange('delay', parseInt(e.target.value) || 1)}
                  className="w-1/2 rounded-r-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={1}
                />
                <select
                  value={formState.unit || 'hours'}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className="w-1/2 p-2 border border-l-0 rounded-l-none rounded-r focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'leadSource':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Type
              </label>
              <select
                value={formState.source || 'Website'}
                onChange={(e) => handleChange('source', e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Social Media">Social Media</option>
                <option value="Advertisement">Advertisement</option>
                <option value="Event">Event</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const saveChanges = () => {
    // Apply all changes at once
    onClose();
  };

  return (
    <div className="w-80 bg-white border-l shadow-lg p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Configure Node</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Node Label
        </label>
        <Input
          type="text"
          value={formState.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {renderConfigFields()}

      <div className="mt-6">
        <Button 
          onClick={saveChanges}
          className="w-full"
        >
          Apply Changes
        </Button>
      </div>
    </div>
  );
};

export default NodeConfiguration;
