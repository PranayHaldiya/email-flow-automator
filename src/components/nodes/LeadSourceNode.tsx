
import { Handle, Position } from 'reactflow';

interface LeadSourceNodeProps {
  data: {
    source: string;
    label: string;
  };
  isConnectable: boolean;
}

const LeadSourceNode = ({ data, isConnectable }: LeadSourceNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-green-500 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2"
      />
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <div className="font-bold">{data.label}</div>
        </div>
        <div className="text-xs mt-1 text-gray-700">
          Source: {data.source}
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

export default LeadSourceNode;
