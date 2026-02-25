import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  User,
  BookOpen,
  Key,
  GraduationCap,
  MessageSquare,
  Headphones,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";

export default function SupportDashboard() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{
    name: string | null;
    email: string;
  } | null>(null);

  // Fetch support permissions
  const { data: perms, isLoading: permsLoading } = trpc.supportDashboard.myPermissions.useQuery();

  // Client search
  const { data: searchResults, isLoading: searching } =
    trpc.supportDashboard.searchClients.useQuery(
      { query: searchSubmitted },
      { enabled: searchSubmitted.length > 0 }
    );

  // Selected client data (conditionally fetched)
  const hasPerm = (p: string) => perms?.isAdmin || perms?.permissions?.includes(p);

  const { data: clientProgress, isLoading: loadingProgress } =
    trpc.supportDashboard.clientProgress.useQuery(
      { userId: selectedUserId! },
      { enabled: !!selectedUserId && !!hasPerm("view_progress") }
    );

  const { data: clientSubs, isLoading: loadingSubs } =
    trpc.supportDashboard.clientSubscriptions.useQuery(
      { userId: selectedUserId! },
      { enabled: !!selectedUserId && !!hasPerm("view_subscriptions") }
    );

  const { data: clientQuizzes, isLoading: loadingQuizzes } =
    trpc.supportDashboard.clientQuizProgress.useQuery(
      { userId: selectedUserId! },
      { enabled: !!selectedUserId && !!hasPerm("view_quizzes") }
    );

  const { data: recFeed, isLoading: loadingRecs } =
    trpc.supportDashboard.recommendationFeed.useQuery(undefined, {
      enabled: !!hasPerm("view_recommendations") && !selectedUserId,
    });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedUserId(null);
    setSelectedUserInfo(null);
    setSearchSubmitted(searchQuery.trim());
  };

  const selectClient = (client: { id: number; name: string | null; email: string }) => {
    setSelectedUserId(client.id);
    setSelectedUserInfo({ name: client.name, email: client.email });
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  if (permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top bar */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-bold">Support Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/support">
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-1" /> Chat
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                {user?.name?.charAt(0).toUpperCase() || "S"}
              </div>
              <span className="text-sm font-medium hidden md:inline">{user?.name}</span>
            </div>
            <button
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1 rounded-full text-gray-600 hover:bg-gray-100"
            >
              {language === "ar" ? "EN" : "عربي"}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-600 px-1.5">
              ×
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
        {/* Permission badges */}
        <div className="flex flex-wrap gap-2">
          {perms?.isAdmin && <Badge className="bg-red-100 text-red-800">Admin (Full Access)</Badge>}
          {hasPerm("support") && <Badge className="bg-blue-100 text-blue-800">Support</Badge>}
          {hasPerm("client_lookup") && <Badge className="bg-indigo-100 text-indigo-800">Client Lookup</Badge>}
          {hasPerm("view_progress") && <Badge className="bg-green-100 text-green-800">View Progress</Badge>}
          {hasPerm("view_subscriptions") && <Badge className="bg-cyan-100 text-cyan-800">View Subscriptions</Badge>}
          {hasPerm("view_quizzes") && <Badge className="bg-orange-100 text-orange-800">View Quizzes</Badge>}
          {hasPerm("view_recommendations") && <Badge className="bg-pink-100 text-pink-800">View Recommendations</Badge>}
        </div>

        {/* Search section */}
        {(hasPerm("client_lookup") || hasPerm("support")) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" /> Client Lookup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email, name, or phone..."
                  className="flex-1 border rounded-md px-3 py-2 text-sm"
                />
                <Button type="submit" disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1">Search</span>
                </Button>
              </form>

              {/* Search results */}
              {searchResults && searchResults.length > 0 && !selectedUserId && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name || "—"}</TableCell>
                          <TableCell>{c.email}</TableCell>
                          <TableCell>{c.phone || "—"}</TableCell>
                          <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => selectClient(c)}>
                              <User className="h-4 w-4 mr-1" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {searchResults && searchResults.length === 0 && searchSubmitted && (
                <p className="text-center text-muted-foreground py-4">No clients found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Selected client details */}
        {selectedUserId && selectedUserInfo && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(null); setSelectedUserInfo(null); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {(selectedUserInfo.name || selectedUserInfo.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-lg">{selectedUserInfo.name || "—"}</h2>
                  <p className="text-sm text-muted-foreground">{selectedUserInfo.email}</p>
                </div>
              </div>
            </div>

            {/* Course Progress */}
            {hasPerm("view_progress") && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5" /> Course Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingProgress ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !clientProgress || clientProgress.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No enrollments found</p>
                  ) : (
                    <div className="space-y-4">
                      {clientProgress.map((enr: any) => (
                        <div key={enr.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{enr.courseName}</h3>
                            <Badge variant={enr.completedAt ? "default" : "secondary"}>
                              {enr.completedAt ? "Completed" : "In Progress"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>Episodes: {enr.completedEpisodes}/{Number(enr.totalEpisodes)}</span>
                            <span>Progress: {enr.progressPercentage}%</span>
                            <span>Enrolled: {new Date(enr.enrolledAt).toLocaleDateString()}</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full transition-all"
                              style={{ width: `${Math.min(enr.progressPercentage, 100)}%` }}
                            />
                          </div>
                          {/* Episode-level detail */}
                          {enr.episodeProgress && enr.episodeProgress.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {enr.episodeProgress.map((ep: any) => (
                                <div key={ep.id} className="flex items-center gap-1.5 text-xs">
                                  {ep.isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  ) : (
                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                  )}
                                  <span>Ep {ep.episodeId}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Subscriptions & Keys */}
            {hasPerm("view_subscriptions") && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5" /> Subscriptions & Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSubs ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* LexAI */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          LexAI
                          {clientSubs?.lexai ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </h4>
                        {clientSubs?.lexai ? (
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Messages: {clientSubs.lexai.messagesUsed}/{clientSubs.lexai.messagesLimit}</p>
                            <p>Expires: {new Date(clientSubs.lexai.endDate).toLocaleDateString()}</p>
                            <p>Status: {clientSubs.lexai.paymentStatus}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No active subscription</p>
                        )}
                      </div>

                      {/* Recommendations */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          Recommendations
                          {clientSubs?.recommendation ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </h4>
                        {clientSubs?.recommendation ? (
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Expires: {new Date(clientSubs.recommendation.endDate).toLocaleDateString()}</p>
                            <p>Status: {clientSubs.recommendation.paymentStatus}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No active subscription</p>
                        )}
                      </div>

                      {/* Course Enrollments */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          Courses
                          <Badge variant="secondary" className="text-xs">
                            {clientSubs?.enrollments?.length ?? 0} enrolled
                          </Badge>
                        </h4>
                        {(clientSubs?.enrollments ?? []).length > 0 ? (
                          <div className="text-sm text-muted-foreground space-y-1">
                            {(clientSubs?.enrollments ?? []).map((e: any) => (
                              <p key={e.id}>{e.courseName} — {e.progressPercentage}%</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No enrollments</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quiz Progress */}
            {hasPerm("view_quizzes") && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" /> Quiz Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingQuizzes ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !clientQuizzes || clientQuizzes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No quiz attempts found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quiz</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientQuizzes.map((q: any) => (
                          <TableRow key={q.attemptId}>
                            <TableCell className="font-medium">{q.quizTitle || `Quiz #${q.quizId}`}</TableCell>
                            <TableCell>{q.quizLevel ?? "—"}</TableCell>
                            <TableCell>{q.score}/{q.totalQuestions} ({q.percentage}%)</TableCell>
                            <TableCell>
                              {q.passed ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Passed
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="h-3 w-3 mr-1" /> Failed
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{new Date(q.completedAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Recommendation feed (when no client selected) */}
        {!selectedUserId && hasPerm("view_recommendations") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Recommendation Group Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRecs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !recFeed || recFeed.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recommendations yet</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {recFeed.map((msg: any) => (
                    <div key={msg.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">{msg.type}</Badge>
                          {msg.symbol && <span className="font-semibold text-sm">{msg.symbol}</span>}
                          {msg.side && (
                            <Badge className={msg.side === "buy" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {msg.side}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {(msg.entryPrice || msg.stopLoss || msg.takeProfit1) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          {msg.entryPrice && <span>Entry: {msg.entryPrice}</span>}
                          {msg.stopLoss && <span>SL: {msg.stopLoss}</span>}
                          {msg.takeProfit1 && <span>TP1: {msg.takeProfit1}</span>}
                          {msg.takeProfit2 && <span>TP2: {msg.takeProfit2}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
