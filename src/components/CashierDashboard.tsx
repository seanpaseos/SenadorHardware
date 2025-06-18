import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Scan, 
  Receipt, 
  Pause, 
  Play, 
  Search, 
  Plus, 
  Minus, 
  LogOut,
  Calculator,
  AlertCircle,
  Bell,
  X
} from 'lucide-react';
import { AuthUser, logout } from '../services/authService';
import { Product, CartItem, Transaction, Notification } from '../types';
import { 
  getProducts, 
  addTransaction, 
  subscribeToProducts,
  subscribeToNotifications,
  markNotificationAsRead
} from '../services/firestoreService';

interface CashierDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

const HIDDEN_NOTIFICATIONS_KEY = 'hiddenNotifications';
function getHiddenNotifications() {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_NOTIFICATIONS_KEY) || '[]');
  } catch {
    return [];
  }
}
function addHiddenNotification(id) {
  const hidden = getHiddenNotifications();
  if (!hidden.includes(id)) {
    hidden.push(id);
    localStorage.setItem(HIDDEN_NOTIFICATIONS_KEY, JSON.stringify(hidden));
  }
}

const CashierDashboard: React.FC<CashierDashboardProps> = ({ user, onLogout }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [heldTransactions, setHeldTransactions] = useState<CartItem[][]>([]);
  const [showItemLookup, setShowItemLookup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts((productsData) => {
      setProducts(productsData);
      setLoading(false);
    });

    const unsubscribeNotifications = subscribeToNotifications(user.role, (notificationsData) => {
      setNotifications(notificationsData.filter(n => !getHiddenNotifications().includes(n.id)));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeNotifications();
    };
  }, [user.role]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      alert('This item is out of stock!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.currentStock) {
        alert('Cannot add more items. Insufficient stock!');
        return;
      }
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + change;
        if (newQuantity > item.currentStock) {
          alert('Cannot exceed available stock!');
          return item;
        }
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const holdTransaction = () => {
    if (cart.length > 0) {
      setHeldTransactions([...heldTransactions, cart]);
      setCart([]);
    }
  };

  const resumeTransaction = (index: number) => {
    setCart(heldTransactions[index]);
    setHeldTransactions(heldTransactions.filter((_, i) => i !== index));
  };

  const exportToPDF = (transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
    const now = new Date();
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - Senador Hardware</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2 { text-align: center; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .total { font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Senador Hardware</h1>
          <h2>Official Receipt</h2>
          <p>Receipt #: ${Math.floor(Math.random() * 1000000)}</p>
          <p>Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
          <p>Cashier: ${user.name}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${transaction.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>₱${item.price.toFixed(2)}</td>
                  <td>₱${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="total">Subtotal: ₱${transaction.total.toFixed(2)}</p>
          <p class="total">VAT (12%): ₱${(transaction.total * 0.12).toFixed(2)}</p>
          <p class="total">Total: ₱${(transaction.total * 1.12).toFixed(2)}</p>
          <p>Payment Method: ${transaction.paymentMethod}</p>
          <p>Status: ${transaction.status}</p>
          <p style="text-align:center;margin-top:20px;">Thank you for shopping with us!</p>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const processPayment = async () => {
    if (cart.length === 0) return;

    // Check if the user has the 'cashier' role
    if (user.role !== 'cashier') {
      alert('You do not have permission to process payments.');
      return;
    }

    setProcessing(true);
    try {
      const transactionData: Omit<Transaction, 'id' | 'timestamp'> = {
        items: cart,
        total: calculateTotal(),
        cashierId: user.uid,
        cashierName: user.name,
        paymentMethod: 'cash',
        status: 'completed'
      };

      await addTransaction(transactionData);
      
      // Generate printable receipt
      exportToPDF(transactionData);
      
      // Show success message
      alert(`Transaction completed! Total: ₱${(calculateTotal() * 1.12).toFixed(2)}\nReceipt has been downloaded.`);
      setCart([]);
    } catch (error) {
      console.error('Transaction failed:', error);
      alert('Transaction failed. Please check the console for details and try again.');
    } finally {
      setProcessing(false);
    }
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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
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
              <ShoppingCart className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Cashier Dashboard</h1>
                <p className="text-gray-600">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowItemLookup(!showItemLookup)}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Search className="w-4 h-4 mr-2" />
                Item Lookup
              </button>
              
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
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
                              <AlertCircle className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium text-sm text-gray-800">{notification.title}</p>
                                <p className="text-sm text-gray-600">{notification.message}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {notification.createdAt.toLocaleDateString()} {notification.createdAt.toLocaleTimeString()}
                                </p>
                              </div>
                              <button
                                className="ml-2 text-gray-400 hover:text-red-600"
                                onClick={e => { e.stopPropagation(); addHiddenNotification(notification.id); setNotifications(notifications.filter(n => n.id !== notification.id)); }}
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
        {/* Left Panel - Product Search & Held Transactions */}
        <div className="w-1/3 bg-white border-r p-6 overflow-y-auto">
          {/* Product Search */}
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <Scan className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold">Add Items</h3>
            </div>
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    product.currentStock > 0 
                      ? 'hover:bg-blue-50 hover:border-blue-300' 
                      : 'bg-gray-50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.barcode}</p>
                      <p className={`text-xs ${product.currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Stock: {product.currentStock}
                      </p>
                    </div>
                    <p className="font-semibold text-blue-600">₱{product.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Held Transactions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Pause className="w-5 h-5 text-orange-600 mr-2" />
                <h3 className="text-lg font-semibold">Held Transactions</h3>
              </div>
              <button
                onClick={holdTransaction}
                disabled={cart.length === 0}
                className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hold Current
              </button>
            </div>
            <div className="space-y-2">
              {heldTransactions.map((transaction, index) => (
                <div
                  key={index}
                  onClick={() => resumeTransaction(index)}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Transaction #{index + 1}</p>
                      <p className="text-sm text-gray-500">{transaction.length} items</p>
                    </div>
                    <Play className="w-4 h-4 text-orange-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Current Transaction */}
        <div className="flex-1 flex flex-col">
          {/* Cart Items */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center mb-4">
              <Calculator className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold">Current Transaction</h3>
            </div>
            
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No items in cart</p>
                <p className="text-sm">Search and add items to start a transaction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">₱{item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <p className="w-20 text-right font-semibold">₱{(item.price * item.quantity).toFixed(2)}</p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 ml-4"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Section */}
          <div className="bg-white border-t p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Total:</span>
                <span className="text-green-600">₱{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={processPayment}
                disabled={cart.length === 0 || processing}
                className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                <Receipt className="w-5 h-5 mr-2" />
                {processing ? 'Processing...' : 'Process Payment'}
              </button>
              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Lookup Modal */}
      {showItemLookup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Item Lookup</h3>
              <button
                onClick={() => setShowItemLookup(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">Barcode: {product.barcode}</p>
                      <p className={`text-sm ${product.currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        In Stock: {product.currentStock} units
                      </p>
                    </div>
                    <p className="font-semibold text-lg">₱{product.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierDashboard;