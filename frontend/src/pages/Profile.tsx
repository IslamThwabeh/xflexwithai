import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import ClientLayout from "@/components/ClientLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Loader2, Check, AlertCircle, Eye, EyeOff, Mail, Bell } from "lucide-react";
import { Link } from "wouter";

export default function Profile() {
  const { t, language } = useLanguage();
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
  const [securityMessage, setSecurityMessage] = useState("");

  // OTP password reset state
  const [showOtpReset, setShowOtpReset] = useState(false);
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpCode, setOtpCode] = useState("");
  const [otpNewPassword, setOtpNewPassword] = useState("");
  const [otpConfirmPassword, setOtpConfirmPassword] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [showOtpPasswords, setShowOtpPasswords] = useState({ new: false, confirm: false });
  const [loginSecurityMode, setLoginSecurityMode] = useState<"password_or_otp" | "password_only" | "password_plus_otp">(
    ((user as any)?.loginSecurityMode as "password_or_otp" | "password_only" | "password_plus_otp") || "password_or_otp"
  );

  // Notification preferences state
  const parsedPrefs = (() => {
    try { return JSON.parse((user as any)?.notificationPrefs || '{}'); } catch { return {}; }
  })();
  const [notifPrefs, setNotifPrefs] = useState({
    support_replies: parsedPrefs.support_replies !== false,
    recommendations: parsedPrefs.recommendations !== false,
    course_updates: parsedPrefs.course_updates !== false,
    admin_announcements: parsedPrefs.admin_announcements !== false,
  });
  const [notifMessage, setNotifMessage] = useState("");

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

  const updateLoginSecurityMutation = trpc.users.updateLoginSecurity.useMutation({
    onSuccess: async () => {
      setSecurityMessage(t("profile.security.loginMethod.updated"));
      await utils.auth.me.invalidate();
      setTimeout(() => setSecurityMessage(""), 3000);
    },
    onError: (error) => {
      setSecurityMessage(`Error: ${error.message}`);
    },
  });

  const updateNotifPrefsMutation = trpc.users.updateNotificationPrefs.useMutation({
    onSuccess: async () => {
      setNotifMessage(language === "ar" ? "تم حفظ تفضيلات الإشعارات" : "Notification preferences saved");
      await utils.auth.me.invalidate();
      setTimeout(() => setNotifMessage(""), 3000);
    },
    onError: (error) => {
      setNotifMessage(`Error: ${error.message}`);
    },
  });

  // OTP password reset mutations
  const requestResetCodeMutation = trpc.auth.requestPasswordResetCode.useMutation({
    onSuccess: () => {
      setOtpStep("verify");
      setOtpMessage(language === "ar" ? "تم إرسال رمز التحقق إلى بريدك الإلكتروني" : "Verification code sent to your email");
      setTimeout(() => setOtpMessage(""), 5000);
    },
    onError: () => {
      setOtpMessage(language === "ar" ? "حدث خطأ. حاول مرة أخرى." : "An error occurred. Try again.");
    },
  });

  const resetPasswordWithOtpMutation = trpc.auth.resetPasswordWithOtp.useMutation({
    onSuccess: () => {
      setOtpMessage(language === "ar" ? "تم تغيير كلمة المرور بنجاح!" : "Password changed successfully!");
      setShowOtpReset(false);
      setOtpStep("request");
      setOtpCode("");
      setOtpNewPassword("");
      setOtpConfirmPassword("");
      setTimeout(() => setOtpMessage(""), 3000);
    },
    onError: (error) => {
      setOtpMessage(error.message);
    },
  });

  const handleRequestResetCode = () => {
    if (!user?.email) return;
    setOtpMessage("");
    requestResetCodeMutation.mutate({ email: user.email });
  };

  const handleResetWithOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpMessage("");
    if (!otpCode || otpCode.length !== 6) {
      setOtpMessage(language === "ar" ? "أدخل رمز التحقق المكون من 6 أرقام" : "Enter the 6-digit code");
      return;
    }
    if (otpNewPassword !== otpConfirmPassword) {
      setOtpMessage(language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match");
      return;
    }
    if (otpNewPassword.length < 8) {
      setOtpMessage(language === "ar" ? "كلمة المرور قصيرة جداً (8 أحرف كحد أدنى)" : "Password too short (minimum 8 characters)");
      return;
    }
    resetPasswordWithOtpMutation.mutate({
      email: user!.email,
      code: otpCode,
      newPassword: otpNewPassword,
    });
  };

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

  const handleUpdateLoginSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMessage("");
    updateLoginSecurityMutation.mutate({ loginSecurityMode });
  };

  return (
    <ClientLayout>
      <div className="min-h-screen bg-[var(--color-xf-cream)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/courses">
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

          {/* Notification Preferences */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {language === "ar" ? "تفضيلات الإشعارات" : "Notification Preferences"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "اختر أنواع الإشعارات التي ترغب في استلامها عبر البريد الإلكتروني"
                  : "Choose which notification types you'd like to receive via email"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifMessage && (
                <Alert className={`mb-4 ${notifMessage.startsWith("Error") ? "border-red-500" : "border-green-500"}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{notifMessage}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-4">
                {([
                  { key: "support_replies" as const, labelAr: "ردود الدعم الفني", labelEn: "Support Replies", descAr: "عند الرد على طلبات الدعم الخاصة بك", descEn: "When your support tickets receive a reply" },
                  { key: "recommendations" as const, labelAr: "التوصيات", labelEn: "Recommendations", descAr: "توصيات التداول والتنبيهات", descEn: "Trading recommendations and alerts" },
                  { key: "course_updates" as const, labelAr: "تحديثات الدورات", labelEn: "Course Updates", descAr: "حلقات أو محتوى جديد في دوراتك", descEn: "New episodes or content in your courses" },
                  { key: "admin_announcements" as const, labelAr: "إعلانات الإدارة", labelEn: "Admin Announcements", descAr: "إعلانات عامة من الأكاديمية", descEn: "General announcements from the academy" },
                ]).map(({ key, labelAr, labelEn, descAr, descEn }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-emerald-50/50 transition-colors">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      checked={notifPrefs[key]}
                      onChange={(e) => setNotifPrefs(prev => ({ ...prev, [key]: e.target.checked }))}
                    />
                    <div>
                      <div className="font-medium text-sm">{language === "ar" ? labelAr : labelEn}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{language === "ar" ? descAr : descEn}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t text-xs text-gray-500 dark:text-gray-400">
                {language === "ar"
                  ? "ملاحظة: لن يتم إرسال إشعارات عبر البريد أثناء تواجدك على المنصة"
                  : "Note: Email notifications are suppressed while you're active on the platform"}
              </div>
              <Button
                className="mt-4 gap-2"
                disabled={updateNotifPrefsMutation.isPending}
                onClick={() => updateNotifPrefsMutation.mutate(notifPrefs)}
              >
                {updateNotifPrefsMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{language === "ar" ? "جارٍ الحفظ..." : "Saving..."}</>
                ) : (
                  <><Check className="w-4 h-4" />{language === "ar" ? "حفظ التفضيلات" : "Save Preferences"}</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.security.title")}</CardTitle>
              <CardDescription>{t("profile.security.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 rounded-lg border border-emerald-100 p-4 bg-emerald-50/30">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{t("profile.security.loginMethodTitle")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {t("profile.security.loginMethodDescription")}
                </p>

                {securityMessage && (
                  <Alert className={`mb-4 ${securityMessage.startsWith("Error") ? "border-red-500" : "border-green-500"}`}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{securityMessage}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleUpdateLoginSecurity} className="space-y-3">
                  <Label htmlFor="login-security-mode">{t("profile.security.loginMethodLabel")}</Label>
                  <select
                    id="login-security-mode"
                    value={loginSecurityMode}
                    onChange={(e) => setLoginSecurityMode(e.target.value as "password_or_otp" | "password_only" | "password_plus_otp")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="password_or_otp">{t("profile.security.loginMethod.passwordOrOtp")}</option>
                    <option value="password_only">{t("profile.security.loginMethod.passwordOnly")}</option>
                    <option value="password_plus_otp">{t("profile.security.loginMethod.passwordPlusOtp")}</option>
                  </select>
                  <Button type="submit" variant="outline" disabled={updateLoginSecurityMutation.isPending}>
                    {updateLoginSecurityMutation.isPending ? t("profile.security.loginMethod.saving") : t("profile.security.loginMethod.save")}
                  </Button>
                </form>
              </div>

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

              {/* OTP Password Reset - Alternative Method */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {language === "ar" ? "نسيت كلمة المرور الحالية؟" : "Forgot your current password?"}
                </p>
                {!showOtpReset ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowOtpReset(true); setOtpStep("request"); setOtpMessage(""); }}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    {language === "ar" ? "تغيير عبر رمز التحقق (OTP)" : "Change via OTP Code"}
                  </Button>
                ) : (
                  <div className="space-y-4 bg-emerald-50/30 rounded-lg p-4">
                    {otpMessage && (
                      <Alert className={`${otpMessage.includes("success") || otpMessage.includes("نجاح") || otpMessage.includes("تم إرسال") || otpMessage.includes("sent") ? "border-green-500" : "border-red-500"}`}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{otpMessage}</AlertDescription>
                      </Alert>
                    )}

                    {otpStep === "request" && (
                      <div className="space-y-3">
                        <p className="text-sm">
                          {language === "ar"
                            ? `سيتم إرسال رمز تحقق إلى: ${user?.email}`
                            : `A verification code will be sent to: ${user?.email}`}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleRequestResetCode}
                            disabled={requestResetCodeMutation.isPending}
                            size="sm"
                          >
                            {requestResetCodeMutation.isPending ? (
                              <><Loader2 className="w-4 h-4 animate-spin me-2" />{language === "ar" ? "جارٍ الإرسال..." : "Sending..."}</>
                            ) : (
                              language === "ar" ? "إرسال الرمز" : "Send Code"
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowOtpReset(false)}>
                            {language === "ar" ? "إلغاء" : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {otpStep === "verify" && (
                      <form onSubmit={handleResetWithOtp} className="space-y-4">
                        <div>
                          <Label>{language === "ar" ? "رمز التحقق" : "Verification Code"}</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                            placeholder="000000"
                            className="mt-1 text-center tracking-[0.5em] font-mono text-lg"
                          />
                        </div>
                        <div>
                          <Label>{language === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
                          <div className="relative mt-1">
                            <Input
                              type={showOtpPasswords.new ? "text" : "password"}
                              value={otpNewPassword}
                              onChange={(e) => setOtpNewPassword(e.target.value)}
                              placeholder={language === "ar" ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
                              className="pr-10"
                            />
                            <button type="button" onClick={() => setShowOtpPasswords(p => ({ ...p, new: !p.new }))} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                              {showOtpPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label>{language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
                          <div className="relative mt-1">
                            <Input
                              type={showOtpPasswords.confirm ? "text" : "password"}
                              value={otpConfirmPassword}
                              onChange={(e) => setOtpConfirmPassword(e.target.value)}
                              placeholder={language === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                              className="pr-10"
                            />
                            <button type="button" onClick={() => setShowOtpPasswords(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                              {showOtpPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={resetPasswordWithOtpMutation.isPending} size="sm">
                            {resetPasswordWithOtpMutation.isPending ? (
                              <><Loader2 className="w-4 h-4 animate-spin me-2" />{language === "ar" ? "جارٍ التغيير..." : "Changing..."}</>
                            ) : (
                              <><Check className="w-4 h-4 me-2" />{language === "ar" ? "تغيير كلمة المرور" : "Change Password"}</>
                            )}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setShowOtpReset(false); setOtpStep("request"); setOtpCode(""); setOtpNewPassword(""); setOtpConfirmPassword(""); }}>
                            {language === "ar" ? "إلغاء" : "Cancel"}
                          </Button>
                          <Button type="button" variant="link" size="sm" onClick={handleRequestResetCode} disabled={requestResetCodeMutation.isPending}>
                            {language === "ar" ? "إعادة إرسال الرمز" : "Resend Code"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientLayout>
  );
}
