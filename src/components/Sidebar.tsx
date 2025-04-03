import React from 'react';
import { Mail, Clock, User, Save, List } from 'lucide-react';

const Sidebar = () => {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white border-r p-4">
      <h2 className="font-semibold text-lg mb-4">Nodes</h2>
      
      <div className="space-y-3">
        <div 
          className="p-3 border rounded shadow-sm bg-white cursor-grab flex items-center"
          onDragStart={(e) => onDragStart(e, 'coldEmail')}
          draggable
        >
          <Mail className="mr-2 h-5 w-5 text-blue-500" />
          <span>Cold Email</span>
        </div>
        
        <div 
          className="p-3 border rounded shadow-sm bg-white cursor-grab flex items-center"
          onDragStart={(e) => onDragStart(e, 'waitDelay')}
          draggable
        >
          <Clock className="mr-2 h-5 w-5 text-amber-500" />
          <span>Wait/Delay</span>
        </div>
        
        <div 
          className="p-3 border rounded shadow-sm bg-white cursor-grab flex items-center"
          onDragStart={(e) => onDragStart(e, 'leadSource')}
          draggable
        >
          <User className="mr-2 h-5 w-5 text-green-500" />
          <span>Lead Source</span>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold mb-2">Instructions</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Drag nodes onto the canvas</li>
          <li>• Connect nodes to create a sequence</li>
          <li>• Click on a node to configure it</li>
          <li>• Save your flow to preserve your work</li>
          <li>• Create multiple flows for different campaigns</li>
          <li>• Schedule when ready to send emails</li>
        </ul>
      </div>
      
      <div className="mt-8 p-3 bg-blue-50 border border-blue-100 rounded">
        <h3 className="font-semibold text-blue-700 flex items-center">
          <Save className="mr-2 h-4 w-4" />
          Flow Management
        </h3>
        <p className="text-sm text-blue-600 mt-1">
          Your work is automatically saved when you switch flows. Use the "Manage Flows" button to create, save, and load different email sequences.
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
