import React from 'react';
import { UserRole } from '../App';
import { Wrench, CreditCard, ClipboardCheck } from 'lucide-react';

interface RoleSelectionProps {
  onRoleSelect: (role: UserRole) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onRoleSelect }) => {
  const roles = [
    {
      id: 'owner' as const,
      title: 'Owner',
      description: 'Full system access and business management',
      icon: Wrench,
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'cashier' as const,
      title: 'Cashier',
      description: 'Point of sale and transaction management',
      icon: CreditCard,
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'checker' as const,
      title: 'Checker',
      description: 'Inventory management and stock control',
      icon: ClipboardCheck,
      color: 'from-green-500 to-emerald-600'
    }
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-8">
      <img src="/photos/Hardware.jpg" alt="Hardware Store" className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 bg-black bg-opacity-60 z-10" />
      <div className="max-w-6xl w-full relative z-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Wrench className="w-12 h-12 text-red-500 mr-4" />
            <h1 className="text-6xl font-bold text-white">Senador Hardware</h1>
          </div>
          <p className="text-2xl text-gray-300 font-medium">
            Welcome! Please select your role to continue
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {roles.map((role) => {
            const IconComponent = role.icon;
            return (
              <div
                key={role.id}
                onClick={() => onRoleSelect(role.id)}
                className="group cursor-pointer transform hover:scale-105 transition-all duration-300 h-full flex flex-col"
              >
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-300 flex flex-col h-full">
                  {/* Gradient Header */}
                  <div className={`h-32 bg-gradient-to-r ${role.color} flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className="w-16 h-16 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="p-8 flex flex-col flex-grow">
                    <h3 className="text-2xl font-bold text-gray-800 mb-3 text-center">
                      {role.title}
                    </h3>
                    <p className="text-gray-600 text-center leading-relaxed flex-grow">
                      {role.description}
                    </p>
                    
                    {/* Button */}
                    <div className="mt-6">
                      <button className={`w-full py-3 px-6 bg-gradient-to-r ${role.color} text-white font-semibold rounded-lg hover:opacity-90 transition-opacity duration-200 shadow-lg`}>
                        Select {role.title}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-gray-400">
            Hardware Store Management System • Secure & Professional
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;