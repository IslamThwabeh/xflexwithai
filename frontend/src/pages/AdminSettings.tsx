// client/src/pages/AdminSettings.tsx
import { Settings, Bell, Lock, Database, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminSettings() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-600">
          Manage your platform settings and configurations
        </p>
      </div>

      {/* Coming Soon Message */}
      <Card className="mb-8 border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            Settings Panel - Coming Soon
          </CardTitle>
          <CardDescription>
            Advanced configuration options are being developed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            The settings panel is currently under development. Soon you'll be able to configure:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>Notification preferences</span>
            </li>
            <li className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-600" />
              <span>Security and authentication settings</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-green-600" />
              <span>Email templates and notifications</span>
            </li>
            <li className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              <span>Database backup and maintenance</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Placeholder Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Settings
            </CardTitle>
            <CardDescription>
              Configure email templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database
            </CardTitle>
            <CardDescription>
              Database maintenance options
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
