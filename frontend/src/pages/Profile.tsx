import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Loader2, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";

export default function Profile() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Profile edit state
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Messages
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  // Update profile mutation
  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: async () => {
      setProfileMessage(t("profile.updates.success"));
      await utils.auth.me.invalidate();
      setTimeout(() => setProfileMessage(""), 3000);
    },
    onError: (error) => {
      setProfileMessage(`${t("profile.error")}: ${error.message}`);
    },
  });

  // Change password mutation
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setPasswordMessage(t("profile.password.changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setTimeout(() => setPasswordMessage(""), 3000);
    },
    onError: (error) => {
      setPasswordMessage(`${t("profile.error")}: ${error.message}`);
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage("");

    updateProfileMutation.mutate({
      name: editName || undefined,
      phone: editPhone || undefined,
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage(t("profile.password.allFieldsRequired"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(t("profile.password.mismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage(t("profile.password.tooShort"));
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/dashboard">
              <Button variant="ghost" className="mb-4">
                ← {t("profile.backToDashboard")}
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("profile.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {t("profile.description")}
            </p>
          </div>

          {/* Profile Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("profile.profileInfo.title")}</CardTitle>
              <CardDescription>{t("profile.profileInfo.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {profileMessage && (
                <Alert className={`mb-4 ${profileMessage.includes("Error") ? "border-red-500" : "border-green-500"}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{profileMessage}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email (read-only) */}
                  <div>
                    <Label htmlFor="email">{t("profile.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editEmail}
                      disabled
                      className="mt-2 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t("profile.emailReadonly")}
                    </p>
                  </div>

                  {/* Name */}
                  <div>
                    <Label htmlFor="name">{t("profile.name")}</Label>
                    <Input
                      id="name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t("profile.nameplaceholder")}
                      className="mt-2"
                    />
                  </div>

                  {/* Phone */}
                  <div className="md:col-span-2">
                    <Label htmlFor="phone">{t("profile.phone")}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder={t("profile.phoneExample")}
                      className="mt-2"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="gap-2"
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("profile.updating")}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {t("profile.saveChanges")}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.security.title")}</CardTitle>
              <CardDescription>{t("profile.security.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {passwordMessage && (
                <Alert className={`mb-4 ${passwordMessage.includes("Error") ? "border-red-500" : "border-green-500"}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{passwordMessage}</AlertDescription>
                </Alert>
              )}

              {!showPasswordForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordForm(true)}
                  className="gap-2"
                >
                  {t("profile.password.change")}
                </Button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-6">
                  {/* Current Password */}
                  <div>
                    <Label htmlFor="current-password">{t("profile.password.current")}</Label>
                    <div className="relative mt-2">
                      <Input
                        id="current-password"
                        type={showPasswords.current ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t("profile.password.enterCurrent")}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            current: !showPasswords.current,
                          })
                        }
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.current ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <Label htmlFor="new-password">{t("profile.password.new")}</Label>
                    <div className="relative mt-2">
                      <Input
                        id="new-password"
                        type={showPasswords.new ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t("profile.password.enterNew")}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            new: !showPasswords.new,
                          })
                        }
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.new ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t("profile.password.requirements")}
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <Label htmlFor="confirm-password">{t("profile.password.confirm")}</Label>
                    <div className="relative mt-2">
                      <Input
                        id="confirm-password"
                        type={showPasswords.confirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t("profile.password.confirmNew")}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            confirm: !showPasswords.confirm,
                          })
                        }
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="gap-2"
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("profile.password.updating")}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          {t("profile.password.update")}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      {t("profile.cancel")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
