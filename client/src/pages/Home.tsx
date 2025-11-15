// client/src/pages/Home.tsx
import { useState } from 'react';
import { Link } from 'wouter';
import { BookOpen, Bot, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivationModal } from '@/components/ActivationModal';

export default function Home() {
  const [showCourseActivation, setShowCourseActivation] = useState(false);
  const [showFlexAIActivation, setShowFlexAIActivation] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">
            XFlex Trading Academy
          </h1>
          <p className="text-xl text-gray-600">
            Master Forex Trading with Expert Guidance and AI-Powered Analysis
          </p>
        </div>
        
        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Courses Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition">
            <div className="flex justify-center mb-6">
              <BookOpen className="w-16 h-16 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-4">
              Trading Courses
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Learn Forex trading from basics to advanced strategies with comprehensive video courses.
            </p>
            <ul className="space-y-2 mb-8">
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Complete Trading Course
              </li>
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Price Action Strategies
              </li>
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Risk Management
              </li>
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Technical Analysis
              </li>
            </ul>
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setShowCourseActivation(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              Activate Course Access
            </Button>
          </div>
          
          {/* FlexAI Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition border-2 border-blue-500">
            <div className="flex justify-center mb-6">
              <Bot className="w-16 h-16 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-4">
              FlexAI Assistant
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Get AI-powered chart analysis and trading recommendations powered by advanced AI.
            </p>
            <ul className="space-y-2 mb-8">
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Multi-timeframe Analysis
              </li>
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Support & Resistance
              </li>
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Entry & Exit Points
              </li>
              <li className="flex items-center text-gray-700">
                <span className="mr-2">✓</span> Risk Management Tips
              </li>
            </ul>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700" 
              size="lg"
              onClick={() => setShowFlexAIActivation(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              Activate FlexAI (30 Days)
            </Button>
          </div>
        </div>
      </div>
      
      {/* Activation Modals */}
      {showCourseActivation && (
        <ActivationModal
          type="course"
          onClose={() => setShowCourseActivation(false)}
          onSuccess={() => {
            setShowCourseActivation(false);
            window.location.href = '/courses';
          }}
        />
      )}
      
      {showFlexAIActivation && (
        <ActivationModal
          type="flexai"
          onClose={() => setShowFlexAIActivation(false)}
          onSuccess={() => {
            setShowFlexAIActivation(false);
            window.location.href = '/flexai';
          }}
        />
      )}
    </div>
  );
}
