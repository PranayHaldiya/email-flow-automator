import { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from 'react-router-dom';

import Sidebar from '@/components/Sidebar';
import NodeConfiguration from '@/components/NodeConfiguration';
import FlowManager from '@/components/FlowManager';
import ColdEmailNode from '@/components/nodes/ColdEmailNode';
import WaitDelayNode from '@/components/nodes/WaitDelayNode';
import LeadSourceNode from '@/components/nodes/LeadSourceNode';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import AuthModal from '@/components/auth/AuthModal';
import { authApi, apiRequest, flowsApi } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Loader2, Save, Plus, List } from 'lucide-react';

/**
 * Custom node types for ReactFlow
 */
const nodeTypes = {
  coldEmail: ColdEmailNode,
  waitDelay: WaitDelayNode,
  leadSource: LeadSourceNode,
};

/**
 * Main page component for the email sequence builder
 */
const Index = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [currentFlow, setCurrentFlow] = useState<{ id?: string; name: string } | null>({
    name: 'Untitled Flow'
  });
  const [serverStatus, setServerStatus] = useState<{isRunning: boolean, message: string | null}>({
    isRunning: true,
    message: null
  });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  /**
   * Check server health on component mount
   */
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        await authApi.checkHealth();
        setServerStatus({
          isRunning: true,
          message: null
        });
      } catch (error) {
        console.error("Server health check failed:", error);
        setServerStatus({
          isRunning: false,
          message: "Could not connect to the server. Please make sure the server is running."
        });
      }
    };
    
    checkServerHealth();
  }, []);
  
  /**
   * Check for existing authentication on component mount
   */
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);

      // Attempt to restore the last worked flow from localStorage
      const savedFlowId = localStorage.getItem('lastFlowId');
      if (savedFlowId) {
        loadFlow(savedFlowId).catch((error) => {
          console.error('Error loading saved flow:', error);
          // If flow loading fails, create a new empty flow
          createNewFlow();
        });
      }
    }
  }, []);

  /**
   * Handle node changes (position, selection, etc.)
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  /**
   * Handle edge changes (connections)
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  /**
   * Handle new connections between nodes
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    []
  );

  /**
   * Handle node click to show configuration panel
   */
  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  /**
   * Handle dropping new nodes onto the canvas
   */
  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  /**
   * Handle dropping new nodes onto the canvas
   */
  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');

    if (!type || !reactFlowBounds) return;

    // Get the position where the node was dropped
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    };

    // Create a new node
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position,
      data: getNodeDefaultData(type),
    };

    setNodes((nds) => nds.concat(newNode));
  };

  /**
   * Get default data based on node type
   */
  const getNodeDefaultData = (type: string) => {
    switch (type) {
      case 'coldEmail':
        return {
          label: 'Cold Email',
          subject: 'Introduction',
          body: 'Hello, I wanted to reach out and introduce myself...',
          recipient: ''
        };
      case 'waitDelay':
        return {
          label: 'Wait',
          delay: 1,
          unit: 'days'
        };
      case 'leadSource':
        return {
          label: 'Lead Source',
          source: 'Website'
        };
      default:
        return { label: 'New Node' };
    }
  };

  /**
   * Update node data when configuration changes
   */
  const handleUpdateNodeData = (data: any) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: { ...node.data, ...data },
          };
        }
        return node;
      })
    );
  };

  /**
   * Build an email sequence from the flow
   */
  const buildSequenceFromFlow = () => {
    const sequence: any[] = [];
    
    // Process each node
    nodes.forEach(node => {
      const sequenceItem = {
        id: node.id,
        type: node.type,
        data: { ...node.data },
        delay: node.data.delay || 0,
        unit: node.data.unit || 'hours'
      };
      
      sequence.push(sequenceItem);
    });
    
    return sequence;
  };

  /**
   * Save and schedule the email sequence
   */
  const saveAndScheduleSequence = () => {
    if (nodes.length === 0) {
      toast({
        title: "No sequence to save",
        description: "Please add at least one node to your sequence",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const sequence = buildSequenceFromFlow();
      
      // Navigate to the schedule page with sequence data
      navigate('/schedule', { state: { sequence } });
    } catch (error) {
      console.error("Error preparing sequence:", error);
      
      // More detailed error message
      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error preparing sequence",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  /**
   * Create a new empty flow
   */
  const createNewFlow = () => {
    setNodes([]);
    setEdges([]);
    setCurrentFlow({ name: 'Untitled Flow' });
    localStorage.removeItem('lastFlowId');
  };

  /**
   * Load a flow by ID
   */
  const loadFlow = async (flowId: string) => {
    setIsLoading(true);
    try {
      const flowData = await flowsApi.getFlow(flowId);
      
      setNodes(flowData.nodes || []);
      setEdges(flowData.edges || []);
      setCurrentFlow({
        id: flowData.id,
        name: flowData.name
      });
      
      // Save the loaded flow ID to localStorage
      localStorage.setItem('lastFlowId', flowId);
      
      toast({
        title: "Flow loaded",
        description: `"${flowData.name}" loaded successfully`,
      });
    } catch (error) {
      console.error("Error loading flow:", error);
      toast({
        title: "Error loading flow",
        description: "Could not load the selected flow",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save the current flow
   */
  const saveFlow = async (name: string) => {
    setIsSaving(true);
    try {
      if (currentFlow?.id) {
        // Update existing flow
        await flowsApi.updateFlow(currentFlow.id, {
          name: name || currentFlow.name,
          nodes,
          edges
        });
      } else {
        // Create new flow
        const result = await flowsApi.saveFlow({
          name: name || 'Untitled Flow',
          nodes,
          edges
        });
        
        // Update the current flow with the new ID
        setCurrentFlow({
          id: result.flowId,
          name: result.name
        });
        
        // Save the flow ID to localStorage
        localStorage.setItem('lastFlowId', result.flowId);
      }
    } catch (error) {
      console.error("Error saving flow:", error);
      toast({
        title: "Error saving flow",
        description: "Could not save the flow",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle successful authentication
   */
  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('lastFlowId');
    setIsAuthenticated(false);
  };

  // Show auth modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <AuthModal onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {serverStatus.message && !serverStatus.isRunning && (
        <Alert variant="destructive" className="fixed top-4 right-4 z-50 max-w-md">
          <AlertTitle>Server Connection Error</AlertTitle>
          <AlertDescription>{serverStatus.message}</AlertDescription>
        </Alert>
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-semibold mr-2">
              {currentFlow?.name || 'Email Sequence Builder'}
            </h1>
            {isLoading && <Loader2 className="animate-spin h-5 w-5 ml-2" />}
          </div>
          <div className="flex space-x-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <List className="mr-2 h-4 w-4" />
                  Manage Flows
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Flow Manager</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <FlowManager 
                    onNewFlow={createNewFlow}
                    onLoadFlow={loadFlow}
                    currentFlow={currentFlow}
                    onSaveFlow={saveFlow}
                  />
                </div>
              </SheetContent>
            </Sheet>
            
            <Button 
              onClick={() => saveFlow(currentFlow?.name || 'Untitled Flow')}
              disabled={isSaving}
              variant="outline"
              size="sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Flow
                </>
              )}
            </Button>
            
            <Button 
              onClick={createNewFlow}
              variant="outline"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Flow
            </Button>
            
            <Button 
              onClick={saveAndScheduleSequence}
              disabled={isLoading}
              variant="default"
              size="sm"
            >
              {isLoading ? 'Processing...' : 'Schedule Sequence'}
            </Button>
            
            <Button 
              onClick={handleLogout}
              variant="ghost"
              size="sm"
            >
              Logout
            </Button>
          </div>
        </div>
        <div className="flex-1 flex">
          <div ref={reactFlowWrapper} style={{ height: '100%', width: '100%' }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                onDrop={onDrop}
                onDragOver={onDragOver}
                deleteKeyCode="Delete"
                fitView
              >
                <Background />
                <Controls />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
          {selectedNode && (
            <NodeConfiguration
              node={selectedNode}
              onUpdate={handleUpdateNodeData}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
