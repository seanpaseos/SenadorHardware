import React, { useState, useEffect } from 'react';
import RoleSelection from './components/RoleSelection';
import PasswordEntry from './components/PasswordEntry';
import CashierDashboard from './components/CashierDashboard';
import CheckerDashboard from './components/CheckerDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import LoadingSpinner from './components/LoadingSpinner';
import { getCurrentUser, AuthUser } from './services/authService';

export type UserRole = 'owner' | 'cashier' | 'checker' | null;
export type AppView = 'role-selection' | 'password-entry' | 'dashboard';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('role-selection');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          setSelectedRole(user.role);
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setCurrentView('password-entry');
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setSelectedRole(user.role);
    setCurrentView('dashboard');
  };

  const handleBackToRoleSelection = () => {
    setCurrentView('role-selection');
    setSelectedRole(null);
    setCurrentUser(null);
  };

  const handleLogout = () => {
    setCurrentView('role-selection');
    setSelectedRole(null);
    setCurrentUser(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'role-selection':
        return <RoleSelection onRoleSelect={handleRoleSelect} />;
      
      case 'password-entry':
        return (
          <PasswordEntry
            role={selectedRole!}
            onLoginSuccess={handleLoginSuccess}
            onBack={handleBackToRoleSelection}
          />
        );
      
      case 'dashboard':
        if (!currentUser || !selectedRole) return null;
        
        switch (selectedRole) {
          case 'cashier':
            return <CashierDashboard user={currentUser} onLogout={handleLogout} />;
          case 'checker':
            return <CheckerDashboard user={currentUser} onLogout={handleLogout} />;
          case 'owner':
            return <OwnerDashboard user={currentUser} onLogout={handleLogout} />;
          default:
            return null;
        }
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderCurrentView()}
    </div>
  );
}

export default App;