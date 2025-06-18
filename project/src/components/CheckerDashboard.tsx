import React, { useState, useEffect } from 'react';
import { 
  Package, 
  TruckIcon, 
  AlertTriangle, 
  ClipboardList, 
  Bell, 
  Plus, 
  Minus, 
  LogOut,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { AuthUser, logout } from '../services/authService';
import { Product, StockMovement, Notification } from '../types';
import { 
  getProducts, 
  addStockMovement, 
  subscribeToProducts,
  addNotification,
  subscribeToNotifications,
  markNotificationAsRead
} from '../services/firestoreService';

interface CheckerDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

interface StockUpdateForm {
  productId: string;
  quantity: number;
  type: 'in' | 'out' | 'damaged' | 'returned';
  reason: string;
}

const CheckerDashboard: React.FC<CheckerDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'deliveries' | 'damaged' | 'audit' | 'alerts'>('stock');
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedLowStockItems, setSelectedLowStockItems] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [stockForm, setStockForm] = useState<StockUpdateForm>({
    productId: '',
    quantity: 0,
    type: 'in',
    reason: ''
  });

  const [damageForm, setDamageForm] = useState({
    productId: '',
    quantity: 0,
    type: 'damaged' as const,
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts((productsData) => {
      setProducts(productsData);
      setLoading(false);
    });

    const unsubscribeNotifications = subscribeToNotifications(user.role, (notificationsData) => {
      setNotifications(notificationsData);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeNotifications();
    };
  }, [user.role]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const lowStockItems = products.filter(item => item.currentStock < item.minStock);

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.productId || stockForm.quantity <= 0) return;

    setProcessing(true);
    try {
      const product = products.find(p => p.id === stockForm.productId);
      if (!product) return;

      await addStockMovement({
        productId: stockForm.productId,
        productName: product.name,
        type: stockForm.type,
        quantity: stockForm.quantity,
        reason: stockForm.reason,
        checkerId: user.uid,
        checkerName: user.name
      });

      alert('Stock updated successfully!');
      setStockForm({ productId: '', quantity: 0, type: 'in', reason: '' });
    } catch (error) {
      console.error('Stock update failed:', error);
      alert('Stock update failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDamageReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageForm.productId || damageForm.quantity <= 0) return;

    setProcessing(true);
    try {
      const product = products.find(p => p.id === damageForm.productId);
      if (!product) return;

      await addStockMovement({
        productId: damageForm.productId,
        productName: product.name,
        type: damageForm.type,
        quantity: damageForm.quantity,
        reason: damageForm.reason,
        checkerId: user.uid,
        checkerName: user.name
      });

      alert('Damage report submitted successfully!');
      setDamageForm({
        productId: '',
        quantity: 0,
        type: 'damaged',
        reason: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Damage report failed:', error);
      alert('Damage report failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleStockAlert = async () => {
    if (selectedLowStockItems.length === 0) return;

    setProcessing(true);
    try {
      const selectedProducts = products.filter(p => selectedLowStockItems.includes(p.id));
      const productNames = selectedProducts.map(p => p.name).join(', ');

      await addNotification({
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: `The following items are running low: ${productNames}`,
        isRead: false,
        userId: null,
        targetRoles: ['owner']
      });

      alert(`Alert sent to owner for ${selectedLowStockItems.length} low stock items!`);
      setSelectedLowStockItems([]);
    } catch (error) {
      console.error('Alert failed:', error);
      alert('Failed to send alert. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const toggleLowStockSelection = (itemId: string) => {
    setSelectedLowStockItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Checker Dashboard</h1>
                <p className="text-gray-600">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-green-600 transition-colors"
                >
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-10">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        notifications.slice(0, 10).map(notification => (
                          <div 
                            key={notification.id} 
                            className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${!notification.isRead ? 'bg-blue-50' : ''}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start">
                              <AlertTriangle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium text-sm text-gray-800">{notification.title}</p>
                                <p className="text-sm text-gray-600">{notification.message}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {notification.createdAt.toLocaleDateString()} {notification.createdAt.toLocaleTimeString()}
                                </p>
                              </div>
                              <button
                                className="ml-2 text-gray-400 hover:text-red-600"
                                onClick={e => { e.stopPropagation(); setNotifications(notifications.filter(n => n.id !== notification.id)); }}
                                title="Remove notification"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r">
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('stock')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'stock' ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Package className="w-5 h-5 mr-3" />
              Stock In/Out
            </button>
            <button
              onClick={() => setActiveTab('damaged')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'damaged' ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-5 h-5 mr-3" />
              Damaged/Returned
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'alerts' ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Bell className="w-5 h-5 mr-3" />
              Stock Alerts
              {lowStockItems.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1">
                  {lowStockItems.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Stock In/Out Module */}
          {activeTab === 'stock' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Stock In/Out Management</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Stock Levels */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Current Stock Levels</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {products.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">Min: {item.minStock} units</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${item.currentStock < item.minStock ? 'text-red-600' : 'text-green-600'}`}>
                            {item.currentStock} units
                          </p>
                          <p className="text-sm text-gray-500">₱{item.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Stock Update */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Stock Update</h3>
                  <form onSubmit={handleStockUpdate} className="space-y-4">
                    <select 
                      className="w-full p-3 border rounded-lg"
                      value={stockForm.productId}
                      onChange={(e) => setStockForm({...stockForm, productId: e.target.value})}
                      required
                    >
                      <option value="">Select Item</option>
                      {products.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <div className="flex space-x-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input 
                          type="number" 
                          className="w-full p-3 border rounded-lg" 
                          placeholder="Enter quantity"
                          value={stockForm.quantity || ''}
                          onChange={(e) => setStockForm({...stockForm, quantity: parseInt(e.target.value) || 0})}
                          min="1"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                        <select 
                          className="w-full p-3 border rounded-lg"
                          value={stockForm.type}
                          onChange={(e) => setStockForm({...stockForm, type: e.target.value as 'in' | 'out'})}
                        >
                          <option value="in">Stock In</option>
                          <option value="out">Stock Out</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      placeholder="Notes (optional)"
                      value={stockForm.reason}
                      onChange={(e) => setStockForm({...stockForm, reason: e.target.value})}
                    />
                    <button 
                      type="submit"
                      disabled={processing}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
                    >
                      {processing ? 'Updating...' : 'Update Stock'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Damaged/Returned Items */}
          {activeTab === 'damaged' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Damaged/Returned Items</h2>
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Report Damaged/Returned Item</h3>
                  <form onSubmit={handleDamageReport} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <select 
                      className="p-3 border rounded-lg"
                      value={damageForm.productId}
                      onChange={(e) => setDamageForm({...damageForm, productId: e.target.value})}
                      required
                    >
                      <option value="">Select Item</option>
                      {products.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      className="p-3 border rounded-lg" 
                      placeholder="Quantity"
                      value={damageForm.quantity || ''}
                      onChange={(e) => setDamageForm({...damageForm, quantity: parseInt(e.target.value) || 0})}
                      min="1"
                      required
                    />
                    <select 
                      className="p-3 border rounded-lg"
                      value={damageForm.type}
                      onChange={(e) => setDamageForm({...damageForm, type: e.target.value as 'damaged'})}
                    >
                      <option value="damaged">Damaged</option>
                      <option value="returned">Customer Return</option>
                    </select>
                    <input 
                      type="date" 
                      className="p-3 border rounded-lg"
                      value={damageForm.date}
                      onChange={(e) => setDamageForm({...damageForm, date: e.target.value})}
                      required
                    />
                    <div className="lg:col-span-2">
                      <textarea
                        className="w-full p-3 border rounded-lg"
                        rows={3}
                        placeholder="Description of damage or return reason"
                        value={damageForm.reason}
                        onChange={(e) => setDamageForm({...damageForm, reason: e.target.value})}
                        required
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <button 
                        type="submit"
                        disabled={processing}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
                      >
                        {processing ? 'Reporting...' : 'Report Item'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Stock Alerts */}
          {activeTab === 'alerts' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Stock Alerts</h2>
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-red-600">Low Stock Items</h3>
                    <button
                      onClick={handleStockAlert}
                      disabled={selectedLowStockItems.length === 0 || processing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing ? 'Sending...' : `Alert Owner (${selectedLowStockItems.length})`}
                    </button>
                  </div>
                  
                  {lowStockItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-300" />
                      <p>All items are at adequate stock levels</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lowStockItems.map(item => (
                        <div key={item.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedLowStockItems.includes(item.id)}
                              onChange={() => toggleLowStockSelection(item.id)}
                              className="mr-4 w-4 h-4 text-red-600"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-red-800">{item.name}</p>
                                  <p className="text-sm text-red-600">
                                    Current: {item.currentStock} | Minimum: {item.minStock}
                                  </p>
                                  <p className="text-sm text-gray-600">₱{item.price.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Low Stock
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckerDashboard;