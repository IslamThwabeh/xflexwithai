// client/src/pages/AdminAnalytics.tsx
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminAnalytics() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">
          View insights and metrics about your platform
        </p>
      </div>

      {/* Coming Soon Message */}
      <Card className="mb-8 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Analytics Dashboard - Coming Soon
          </CardTitle>
          <CardDescription>
            We're building powerful analytics features for you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            The analytics dashboard is currently under development. Soon you'll be able to:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span>Track revenue and subscription trends</span>
            </li>
            <li className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Monitor user growth and engagement</span>
            </li>
            <li className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>View course completion rates</span>
            </li>
            <li className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-600" />
              <span>Analyze FlexAI usage statistics</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Placeholder Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">Revenue tracking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">User analytics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Course Completions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">Course metrics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              FlexAI Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">AI analytics</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
