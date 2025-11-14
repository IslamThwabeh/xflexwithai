import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Key, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function ActivateKey() {
  const [, setLocation] = useLocation();
  const [keyCode, setKeyCode] = useState("");
  const [email, setEmail] = useState("");
  const [isActivated, setIsActivated] = useState(false);

  const activateKey = trpc.registrationKeys.activateKey.useMutation({
    onSuccess: (data) => {
      setIsActivated(true);
      toast.success(data.message);
      
      // Redirect to course after 2 seconds
      setTimeout(() => {
        if (data.key?.courseId) {
          setLocation(`/course/${data.key.courseId}`);
        }
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleActivate = () => {
    if (!keyCode.trim()) {
      toast.error("Please enter a registration key");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    activateKey.mutate({ keyCode: keyCode.trim(), email: email.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Key className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Activate Your Course Access</CardTitle>
          <CardDescription>
            Enter your registration key and email to unlock your course
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isActivated ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="keyCode">Registration Key</Label>
                <Input
                  id="keyCode"
                  placeholder="XFLEX-XXXXX-XXXXX-XXXXX"
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                  className="font-mono"
                  disabled={activateKey.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={activateKey.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  This key will be locked to your email address
                </p>
              </div>

              <Button
                onClick={handleActivate}
                disabled={activateKey.isPending}
                className="w-full"
                size="lg"
              >
                {activateKey.isPending ? "Activating..." : "Activate Key"}
              </Button>

              <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Important Information
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Each key can only be activated once</li>
                  <li>The key will be permanently linked to your email</li>
                  <li>You'll get lifetime access to the course</li>
                  <li>Keys cannot be transferred or shared</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-600">
                  Key Activated Successfully!
                </h3>
                <p className="text-muted-foreground mt-2">
                  Redirecting you to your course...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
