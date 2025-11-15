// client/src/pages/AdminEnrollments.tsx
import { GraduationCap, Users, BookOpen, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminEnrollments() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Enrollments</h1>
        <p className="text-gray-600">
          Track student enrollments and course progress
        </p>
      </div>

      {/* Coming Soon Message */}
      <Card className="mb-8 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-green-600" />
            Enrollment Tracking - Coming Soon
          </CardTitle>
          <CardDescription>
            Student progress tracking features are being developed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            The enrollment tracking system is currently under development. Soon you'll be able to:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>View all student enrollments</span>
            </li>
            <li className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span>Track course progress and completion</span>
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span>Monitor student engagement metrics</span>
            </li>
            <li className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-yellow-600" />
              <span>Generate completion certificates</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What are Enrollments?</CardTitle>
          <CardDescription>
            Understanding the enrollment system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            <strong>Enrollments</strong> track which students are taking which courses and their progress through the material.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Key Features (When Implemented):</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Track which users have access to which courses</li>
              <li>• Monitor video watch progress</li>
              <li>• See completion rates per course</li>
              <li>• Identify struggling students who need help</li>
              <li>• Generate reports on student performance</li>
            </ul>
          </div>
          <p className="text-gray-600 mt-4 text-sm">
            <strong>Note:</strong> Currently, course access is managed through registration keys. 
            The enrollment tracking system will provide deeper insights into student progress.
          </p>
        </CardContent>
      </Card>

      {/* Placeholder Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Enrollments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">Student enrollments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">Currently learning</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-gray-500 mt-1">Average completion</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
