import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Loader2, Calendar, Clock, ArrowLeft } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { apiRequest } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const SchedulePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [sequence, setSequence] = useState<any[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("17:00");
  const [sendOption, setSendOption] = useState("schedule"); // "now" or "schedule"
  const [days, setDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });

  // Get hours array for dropdown
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return `${hour}:00`;
  });

  useEffect(() => {
    // If no sequence data in location state, redirect back to home
    if (!location.state?.sequence) {
      toast({
        title: "No sequence data",
        description: "Please create a sequence first",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setSequence(location.state.sequence);
  }, [location.state, navigate]);

  const handleDayToggle = (day: keyof typeof days) => {
    setDays({
      ...days,
      [day]: !days[day],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sendOption === "schedule") {
      if (!date) {
        toast({
          title: "Date required",
          description: "Please select a start date for your sequence",
          variant: "destructive",
        });
        return;
      }

      const selectedDays = Object.entries(days)
        .filter(([_, selected]) => selected)
        .map(([day]) => day);

      if (selectedDays.length === 0) {
        toast({
          title: "Days required",
          description: "Please select at least one day for sending emails",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate that all cold emails have recipients if sending immediately
    if (sendOption === "now") {
      const missingRecipients = sequence
        .filter(item => item.type === 'coldEmail' && !item.data?.recipient)
        .length;
      
      if (missingRecipients > 0) {
        toast({
          title: "Missing recipients",
          description: `${missingRecipients} email(s) in your sequence don't have recipient addresses. Please add recipients to all email nodes.`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      let scheduleData: any = { sequence };
      
      if (sendOption === "schedule") {
        scheduleData.schedulingOptions = {
          startDate: date,
          fromTime,
          toTime,
          days: Object.entries(days)
            .filter(([_, selected]) => selected)
            .map(([day]) => day),
        };
      } else {
        // For immediate sending
        scheduleData.sendNow = true;
      }

      const response = await apiRequest('/api/schedule-sequence', {
        method: 'POST',
        body: JSON.stringify(scheduleData),
      });
      
      toast({
        title: sendOption === "now" ? "Sequence sent" : "Sequence scheduled",
        description: `Successfully ${sendOption === "now" ? "sent" : "scheduled"} ${response.scheduledEmails?.length || 0} emails`,
      });
      
      navigate("/");
    } catch (error) {
      console.error("Error scheduling sequence:", error);
      
      let errorMessage = "An unknown error occurred";
      let errorTitle = "Error scheduling sequence";
      
      // Try to extract more specific error details from the response
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if this is a response error with details
        const responseError = error as any;
        if (responseError.response) {
          try {
            const errorData = await responseError.response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // If we can't parse the JSON, just use the original error message
          }
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-3xl py-10">
      <Button 
        variant="ghost" 
        onClick={() => navigate("/")}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Flow Editor
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Schedule Email Sequence</CardTitle>
          <CardDescription>
            Configure when your email sequence should be sent
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base">Sending Option</Label>
                <RadioGroup 
                  value={sendOption} 
                  onValueChange={setSendOption}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="now" id="now" />
                    <Label htmlFor="now">Send right now</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="schedule" id="schedule" />
                    <Label htmlFor="schedule">Schedule for later</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <Separator />
              
              {sendOption === "schedule" && (
                <>
                  <div>
                    <Label className="text-base">Start Date</Label>
                    <div className="flex mt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !date && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromTime">From Time</Label>
                      <Select value={fromTime} onValueChange={setFromTime}>
                        <SelectTrigger id="fromTime" className="w-full">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {hours.map((hour) => (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="toTime">To Time</Label>
                      <Select value={toTime} onValueChange={setToTime}>
                        <SelectTrigger id="toTime" className="w-full">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {hours.map((hour) => (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label className="text-base">Days to Send Emails</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="monday" 
                          checked={days.monday}
                          onCheckedChange={() => handleDayToggle("monday")}
                        />
                        <Label htmlFor="monday">Monday</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="tuesday" 
                          checked={days.tuesday}
                          onCheckedChange={() => handleDayToggle("tuesday")}
                        />
                        <Label htmlFor="tuesday">Tuesday</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="wednesday" 
                          checked={days.wednesday}
                          onCheckedChange={() => handleDayToggle("wednesday")}
                        />
                        <Label htmlFor="wednesday">Wednesday</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="thursday" 
                          checked={days.thursday}
                          onCheckedChange={() => handleDayToggle("thursday")}
                        />
                        <Label htmlFor="thursday">Thursday</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="friday" 
                          checked={days.friday}
                          onCheckedChange={() => handleDayToggle("friday")}
                        />
                        <Label htmlFor="friday">Friday</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="saturday" 
                          checked={days.saturday}
                          onCheckedChange={() => handleDayToggle("saturday")}
                        />
                        <Label htmlFor="saturday">Saturday</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="sunday" 
                          checked={days.sunday}
                          onCheckedChange={() => handleDayToggle("sunday")}
                        />
                        <Label htmlFor="sunday">Sunday</Label>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                </>
              )}
              
              <div>
                <Label className="text-base">Sequence Summary</Label>
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <p>{sequence.length} email(s) in sequence</p>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {sendOption === "now" ? "Sending..." : "Scheduling..."}
                </>
              ) : (
                sendOption === "now" ? "Send Now" : "Schedule Sequence"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SchedulePage; 