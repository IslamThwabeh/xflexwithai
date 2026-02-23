import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import { MessageSquare, User, ArrowLeft, Trash2, RefreshCw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminLexaiConversations() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // Get all users with conversations
  const { data: conversationUsers, isLoading: loadingUsers } = trpc.lexaiAdmin.conversationUsers.useQuery();
  
  // Get messages for selected user
  const { data: userMessages, isLoading: loadingMessages } = trpc.lexaiAdmin.userMessages.useQuery(
    { userId: selectedUserId!, limit: 200 },
    { enabled: !!selectedUserId }
  );

  // Delete user messages mutation
  const deleteMessagesMutation = trpc.lexaiAdmin.deleteUserMessages.useMutation({
    onSuccess: () => {
      toast.success("Chat history deleted successfully");
      utils.lexaiAdmin.conversationUsers.invalidate();
      utils.lexaiAdmin.userMessages.invalidate();
      setSelectedUserId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleDeleteUserMessages = (userId: number) => {
    deleteMessagesMutation.mutate({ userId });
  };

  const selectedUser = conversationUsers?.find(u => u.userId === selectedUserId);

  if (selectedUserId && selectedUser) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Users
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedUser.userName || "Unknown User"}</h1>
                <p className="text-sm text-muted-foreground">{selectedUser.userEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => utils.lexaiAdmin.userMessages.invalidate()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Messages
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Chat History</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all LexAI chat messages for {selectedUser.userName || selectedUser.userEmail}. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteUserMessages(selectedUserId)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation History
              </CardTitle>
              <CardDescription>
                {userMessages?.length ?? 0} messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMessages ? (
                <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
              ) : !userMessages || userMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No messages found</div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {[...userMessages].reverse().map((message) => (
                      <div
                        key={message.id}
                        className={`p-4 rounded-lg ${
                          message.role === "user"
                            ? "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500"
                            : "bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={message.role === "user" ? "default" : "secondary"}>
                              {message.role === "user" ? "User" : "LexAI"}
                            </Badge>
                            {message.analysisType && (
                              <Badge variant="outline">{message.analysisType}</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {message.createdAt ? format(new Date(message.createdAt), "MMM d, yyyy HH:mm:ss") : "Unknown date"}
                          </span>
                        </div>
                        
                        {message.imageUrl && (
                          <div className="mb-2">
                            <a href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={message.imageUrl} 
                                alt="Chart" 
                                className="max-w-sm rounded border cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            </a>
                          </div>
                        )}
                        
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">LexAI Conversations</h1>
            <p className="text-muted-foreground">Monitor and moderate user conversations</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => utils.lexaiAdmin.conversationUsers.invalidate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Users with conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Users with Conversations
            </CardTitle>
            <CardDescription>
              Click on a user to view their chat history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : !conversationUsers || conversationUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No conversations yet</div>
            ) : (
              <div className="space-y-2">
                {conversationUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setSelectedUserId(user.userId)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{user.userName || "Unknown User"}</p>
                        <p className="text-sm text-muted-foreground">{user.userEmail || `User ID: ${user.userId}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{Number(user.messageCount)} messages</p>
                        <p className="text-xs text-muted-foreground">
                          Last: {user.lastMessageAt ? format(new Date(user.lastMessageAt), "MMM d, HH:mm") : "Unknown"}
                        </p>
                      </div>
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
