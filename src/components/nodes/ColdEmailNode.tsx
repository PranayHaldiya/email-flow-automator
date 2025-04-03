import { Handle, Position } from 'reactflow';
import { Mail } from 'lucide-react';

interface ColdEmailNodeProps {
  data: {
    subject: string;
    body: string;
    label: string;
    recipient: string;
  };
  isConnectable: boolean;
}

const ColdEmailNode = ({ data, isConnectable }: ColdEmailNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-500 min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2"
      />
      <div className="flex flex-col">
        <div className="flex items-center">
          <Mail className="h-4 w-4 text-blue-500 mr-2" />
          <div className="font-bold">{data.label || 'Cold Email'}</div>
        </div>
        <div className="text-xs mt-1 text-gray-700 truncate max-w-[190px]">
          To: {data.recipient || 'No recipient'}
        </div>
        <div className="text-xs mt-1 text-gray-700 truncate max-w-[190px]">
          Subject: {data.subject || 'No subject'}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-2 h-2"
      />
    </div>
  );
};

export default ColdEmailNode;
