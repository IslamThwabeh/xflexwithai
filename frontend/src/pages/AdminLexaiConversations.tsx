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
import { useLanguage } from "@/contexts/LanguageContext";
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

function formatSafeDate(
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "Unknown"
) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, pattern);
}

export default function AdminLexaiConversations() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { t } = useLanguage();

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
                {t('admin.lexai.backToUsers')}
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
                {t('admin.lexai.refresh')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('admin.lexai.deleteAll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin.lexai.deleteHistory')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('admin.lexai.deleteConfirm')} {selectedUser.userName || selectedUser.userEmail}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('admin.lexai.cancelDelete')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteUserMessages(selectedUserId)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('admin.lexai.confirmDelete')}
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
                {t('admin.lexai.convoHistory')}
              </CardTitle>
              <CardDescription>
                {userMessages?.length ?? 0} {t('admin.lexai.messagesCount')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMessages ? (
                <div className="text-center py-8 text-muted-foreground">{t('admin.lexai.loadingMessages')}</div>
              ) : !userMessages || userMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('admin.lexai.noMessages')}</div>
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
                            {formatSafeDate(message.createdAt, "MMM d, yyyy HH:mm:ss", "Unknown date")}
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
            <h1 className="text-3xl font-bold">{t('admin.lexai.conversations')}</h1>
            <p className="text-muted-foreground">{t('admin.lexai.convoSubtitle')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => utils.lexaiAdmin.conversationUsers.invalidate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('admin.lexai.refresh')}
          </Button>
        </div>

        {/* Users with conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('admin.lexai.usersWithConvo')}
            </CardTitle>
            <CardDescription>
              {t('admin.lexai.clickToView')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-8 text-muted-foreground">{t('admin.loading')}</div>
            ) : !conversationUsers || conversationUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('admin.lexai.noConvos')}</div>
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
                        <p className="text-sm font-medium">{Number(user.messageCount)} {t('admin.lexai.messagesCount')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.lexai.lastMessage')} {formatSafeDate(user.lastMessageAt, "MMM d, HH:mm")}
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
