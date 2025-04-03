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
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { templatesApi, EmailTemplateSummary } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash, FilePlus, Eye } from 'lucide-react';

interface EmailTemplateManagerProps {
  onSelectTemplate: (template: { subject: string; body: string }) => void;
}

const EmailTemplateManager = ({ onSelectTemplate }: EmailTemplateManagerProps) => {
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    body: ''
  });
  const [viewingTemplate, setViewingTemplate] = useState<{
    name: string;
    subject: string;
    body: string;
    id?: string;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const { toast } = useToast();

  // Load templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Fetch all templates
  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await templatesApi.getAllTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new template
  const createNewTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.body.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      await templatesApi.createTemplate({
        name: newTemplate.name,
        subject: newTemplate.subject,
        body: newTemplate.body
      });
      
      // Refresh the template list
      await fetchTemplates();
      
      // Reset the form
      setNewTemplate({
        name: '',
        subject: '',
        body: ''
      });
      
      toast({
        title: 'Success',
        description: 'Email template created',
      });
    } catch (error) {
      console.error('Failed to create template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create email template',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Delete a template
  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      await templatesApi.deleteTemplate(id);
      toast({
        title: 'Success',
        description: 'Email template deleted',
      });
      
      // Refresh the template list
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  // Load a template
  const loadTemplate = async (id: string) => {
    setIsTemplateLoading(true);
    try {
      const response = await templatesApi.getTemplate(id);
      const template = response.template;
      
      if (template) {
        onSelectTemplate({
          subject: template.subject,
          body: template.body
        });
        
        toast({
          title: 'Success',
          description: 'Template loaded',
        });
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load template',
        variant: 'destructive',
      });
    } finally {
      setIsTemplateLoading(false);
    }
  };

  // View a template
  const viewTemplate = async (id: string) => {
    setIsTemplateLoading(true);
    try {
      const response = await templatesApi.getTemplate(id);
      const template = response.template;
      
      if (template) {
        setViewingTemplate({
          id: template._id,
          name: template.name,
          subject: template.subject,
          body: template.body
        });
      }
    } catch (error) {
      console.error('Failed to view template:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load template for viewing',
        variant: 'destructive',
      });
    } finally {
      setIsTemplateLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="email-template-manager mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-medium">Email Templates</h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center">
              <Plus className="mr-1 h-3 w-3" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Email Template</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="Follow-up Email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Subject</label>
                <Input
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({...newTemplate, subject: e.target.value})}
                  placeholder="Following up on our conversation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Body</label>
                <Textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({...newTemplate, body: e.target.value})}
                  rows={6}
                  placeholder="Hi {{name}},\n\nI wanted to follow up on our conversation about..."
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                onClick={createNewTemplate} 
                disabled={isCreating || !newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.body.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Template'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* View Template Dialog */}
      <Dialog open={!!viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)}>
        <DialogContent className="md:max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewingTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <h4 className="font-medium mb-1">Subject:</h4>
              <div className="p-2 bg-gray-50 border rounded-md">{viewingTemplate?.subject}</div>
            </div>
            <div>
              <h4 className="font-medium mb-1">Body:</h4>
              <div className="p-3 bg-gray-50 border rounded-md whitespace-pre-wrap">
                {viewingTemplate?.body}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingTemplate(null)}
            >
              Close
            </Button>
            {viewingTemplate && (
              <Button 
                onClick={() => {
                  if (viewingTemplate) {
                    onSelectTemplate({
                      subject: viewingTemplate.subject,
                      body: viewingTemplate.body
                    });
                    setViewingTemplate(null);
                    toast({
                      title: 'Success',
                      description: 'Template loaded',
                    });
                  }
                }}
              >
                Use This Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-gray-50 border rounded-md p-4 text-center">
          <p className="text-gray-500 text-sm">No email templates yet</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{template.subject}</TableCell>
                  <TableCell>{formatDate(template.createdAt.toString())}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => viewTemplate(template.id)}
                      title="View template"
                      disabled={isTemplateLoading}
                    >
                      <Eye className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => loadTemplate(template.id)}
                      title="Use this template"
                      disabled={isTemplateLoading}
                    >
                      <FilePlus className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteTemplate(template.id)}
                      title="Delete template"
                      disabled={isTemplateLoading}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateManager; 