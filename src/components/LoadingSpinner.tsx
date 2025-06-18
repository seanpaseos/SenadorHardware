import React from 'react';
import { Wrench } from 'lucide-react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <img src="/photos/Hardware.jpg" alt="Hardware Store" className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 bg-black bg-opacity-60 z-10" />
      <div className="relative z-20 flex items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="relative">
            <Wrench className="w-16 h-16 text-orange-500 mx-auto animate-spin" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-orange-200 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <h2 className="text-2xl font-bold text-white mt-6">Senador Hardware</h2>
          <p className="text-gray-300 mt-2">Loading system...</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;