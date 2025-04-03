import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { flowsApi, FlowSummary } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash, Edit, ArrowRight } from 'lucide-react';

interface FlowManagerProps {
  onNewFlow: () => void;
  onLoadFlow: (flowId: string) => void;
  currentFlow: { id?: string; name: string } | null;
  onSaveFlow: (name: string) => Promise<void>;
}

const FlowManager = ({ onNewFlow, onLoadFlow, currentFlow, onSaveFlow }: FlowManagerProps) => {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [editFlowName, setEditFlowName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load flows on mount
  useEffect(() => {
    fetchFlows();
  }, []);

  // Fetch all flows
  const fetchFlows = async () => {
    setIsLoading(true);
    try {
      const response = await flowsApi.getAllFlows();
      setFlows(response.flows || []);
    } catch (error) {
      console.error('Failed to fetch flows:', error);
      toast({
        title: 'Error',
        description: 'Failed to load flows',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new flow
  const createNewFlow = async () => {
    if (!newFlowName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for your flow',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create an empty flow
      await flowsApi.saveFlow({
        name: newFlowName,
        nodes: [],
        edges: []
      });
      
      // Refresh the flow list
      await fetchFlows();
      
      // Reset the input and close dialog
      setNewFlowName('');
      setIsCreating(false);
      
      // Create new empty flow in UI
      onNewFlow();
      
      toast({
        title: 'Success',
        description: 'New flow created',
      });
    } catch (error) {
      console.error('Failed to create flow:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new flow',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Save current flow
  const handleSaveFlow = async () => {
    setIsSaving(true);
    try {
      await onSaveFlow(currentFlow?.name || 'Untitled Flow');
      toast({
        title: 'Success',
        description: 'Flow saved successfully',
      });
      // Refresh flow list
      await fetchFlows();
    } catch (error) {
      console.error('Failed to save flow:', error);
      toast({
        title: 'Error',
        description: 'Failed to save flow',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a flow
  const deleteFlow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) {
      return;
    }
    
    try {
      await flowsApi.deleteFlow(id);
      toast({
        title: 'Success',
        description: 'Flow deleted',
      });
      
      // If the current flow was deleted, create a new one
      if (currentFlow?.id === id) {
        onNewFlow();
      }
      
      // Refresh the flow list
      await fetchFlows();
    } catch (error) {
      console.error('Failed to delete flow:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete flow',
        variant: 'destructive',
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="flow-manager">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Flows</h2>
        <div className="space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center">
                <Plus className="mr-1 h-4 w-4" /> New Flow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Flow</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <label className="block text-sm font-medium mb-1">Flow Name</label>
                <Input
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="My Email Sequence"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  onClick={createNewFlow} 
                  disabled={isCreating || !newFlowName.trim()}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {currentFlow && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleSaveFlow}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Current Flow'
              )}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : flows.length === 0 ? (
        <div className="bg-gray-50 border rounded-md p-8 text-center">
          <p className="text-gray-500 mb-4">You don't have any flows yet</p>
          <Button onClick={() => document.querySelector<HTMLButtonElement>('[data-dialog-trigger="new-flow"]')?.click()}>
            Create Your First Flow
          </Button>
        </div>
      ) : (
        <Table>
          <TableCaption>Your saved email sequence flows.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows.map((flow) => (
              <TableRow key={flow.id}>
                <TableCell className="font-medium">{flow.name}</TableCell>
                <TableCell>{formatDate(flow.updatedAt.toString())}</TableCell>
                <TableCell>{formatDate(flow.createdAt.toString())}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => onLoadFlow(flow.id)}
                    title="Load flow"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => deleteFlow(flow.id)}
                    title="Delete flow"
                  >
                    <Trash className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default FlowManager; 