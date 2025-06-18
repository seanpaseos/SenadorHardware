import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Package, 
  DollarSign, 
  Bell, 
  Settings, 
  FileText, 
  Activity, 
  TrendingUp, 
  ShoppingCart,
  AlertTriangle,
  Download,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Filter
} from 'lucide-react';
import { AuthUser, logout } from '../services/authService';
import { Product, Transaction, Notification, SalesReportData } from '../types';
import { 
  getProducts, 
  getTransactions, 
  subscribeToNotifications,
  markNotificationAsRead,
  addProduct,
  updateProduct,
  deleteProduct,
  getTransactionsByDateRange
} from '../services/firestoreService';

interface OwnerDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'inventory' | 'reports' | 'logs' | 'settings'>('overview');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Reports state
  const [reportDateRange, setReportDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [productForm, setProductForm] = useState({
    name: '',
    price: 0,
    barcode: '',
    currentStock: 0,
    minStock: 0,
    category: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, transactionsData] = await Promise.all([
          getProducts(),
          getTransactions()
        ]);
        
        setProducts(productsData);
        setTransactions(transactionsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to notifications
    const unsubscribe = subscribeToNotifications(user.role, (notificationsData) => {
      setNotifications(notificationsData);
    });

    return () => unsubscribe();
  }, [user.role]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const salesData = {
    today: {
      amount: transactions
        .filter(t => new Date(t.timestamp).toDateString() === new Date().toDateString())
        .reduce((sum, t) => sum + t.total, 0),
      transactions: transactions
        .filter(t => new Date(t.timestamp).toDateString() === new Date().toDateString()).length
    },
    week: {
      amount: transactions
        .filter(t => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(t.timestamp) >= weekAgo;
        })
        .reduce((sum, t) => sum + t.total, 0),
      transactions: transactions
        .filter(t => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(t.timestamp) >= weekAgo;
        }).length
    },
    month: {
      amount: transactions
        .filter(t => {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return new Date(t.timestamp) >= monthAgo;
        })
        .reduce((sum, t) => sum + t.total, 0),
      transactions: transactions
        .filter(t => {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return new Date(t.timestamp) >= monthAgo;
        }).length
    }
  };

  const topProducts = products
    .map(product => {
      const sold = transactions
        .flatMap(t => t.items)
        .filter(item => item.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      
      const revenue = transactions
        .flatMap(t => t.items)
        .filter(item => item.id === product.id)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return { ...product, sold, revenue };
    })
    .filter(p => p.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const lowStockCount = products.filter(p => p.currentStock < p.minStock).length;

  const generateDetailedReport = async () => {
    setLoadingReport(true);
    try {
      const startDate = new Date(reportDateRange.startDate);
      const endDate = new Date(reportDateRange.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day

      const reportTransactions = await getTransactionsByDateRange(startDate, endDate);
      
      const totalSales = reportTransactions.reduce((sum, t) => sum + t.total, 0);
      const totalTransactions = reportTransactions.length;
      const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      // Top products in date range
      const productSales = new Map();
      reportTransactions.forEach(transaction => {
        transaction.items.forEach(item => {
          const existing = productSales.get(item.id) || { name: item.name, quantitySold: 0, revenue: 0 };
          existing.quantitySold += item.quantity;
          existing.revenue += item.price * item.quantity;
          productSales.set(item.id, existing);
        });
      });

      const topProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Daily breakdown
      const dailyBreakdown = new Map();
      reportTransactions.forEach(transaction => {
        const date = transaction.timestamp.toDateString();
        const existing = dailyBreakdown.get(date) || { date, sales: 0, transactions: 0 };
        existing.sales += transaction.total;
        existing.transactions += 1;
        dailyBreakdown.set(date, existing);
      });

      // Cashier performance
      const cashierPerformance = new Map();
      reportTransactions.forEach(transaction => {
        const existing = cashierPerformance.get(transaction.cashierId) || { 
          cashierName: transaction.cashierName, 
          sales: 0, 
          transactions: 0 
        };
        existing.sales += transaction.total;
        existing.transactions += 1;
        cashierPerformance.set(transaction.cashierId, existing);
      });

      setReportData({
        totalSales,
        totalTransactions,
        averageTransaction,
        topProducts,
        dailyBreakdown: Array.from(dailyBreakdown.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        cashierPerformance: Array.from(cashierPerformance.values()).sort((a, b) => b.sales - a.sales)
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoadingReport(false);
    }
  };

  const exportToPDF = () => {
    if (!reportData) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Report - Senador Hardware</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
          .summary-card { border: 1px solid #ddd; padding: 15px; text-align: center; }
          .section { margin-bottom: 30px; }
          .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .currency { text-align: right; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Senador Hardware</h1>
          <h2>Sales Report</h2>
          <p>Period: ${reportDateRange.startDate} to ${reportDateRange.endDate}</p>
          <p>Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>Total Sales</h3>
            <p style="font-size: 24px; color: #16a34a;">₱${reportData.totalSales.toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>Total Transactions</h3>
            <p style="font-size: 24px; color: #2563eb;">${reportData.totalTransactions}</p>
          </div>
          <div class="summary-card">
            <h3>Average Transaction</h3>
            <p style="font-size: 24px; color: #7c3aed;">₱${reportData.averageTransaction.toFixed(2)}</p>
          </div>
        </div>

        <div class="section">
          <h3>Top Selling Products</h3>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Quantity Sold</th>
                <th class="currency">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.topProducts.map(product => `
                <tr>
                  <td>${product.name}</td>
                  <td>${product.quantitySold}</td>
                  <td class="currency">₱${product.revenue.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Daily Sales Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transactions</th>
                <th class="currency">Sales</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.dailyBreakdown.map(day => `
                <tr>
                  <td>${new Date(day.date).toLocaleDateString()}</td>
                  <td>${day.transactions}</td>
                  <td class="currency">₱${day.sales.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Cashier Performance</h3>
          <table>
            <thead>
              <tr>
                <th>Cashier Name</th>
                <th>Transactions</th>
                <th class="currency">Sales</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.cashierPerformance.map(cashier => `
                <tr>
                  <td>${cashier.cashierName}</td>
                  <td>${cashier.transactions}</td>
                  <td class="currency">₱${cashier.sales.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportTransactionPDF = (transaction: Transaction) => {
    const now = transaction.timestamp instanceof Date ? transaction.timestamp : new Date(transaction.timestamp);
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
            @media print { body { margin: 0; }
          </style>
        </head>
        <body>
          <h1>Senador Hardware</h1>
          <h2>Official Receipt</h2>
          <p>Receipt #: ${transaction.id}</p>
          <p>Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
          <p>Cashier: ${transaction.cashierName}</p>
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
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      price: 0,
      barcode: '',
      currentStock: 0,
      minStock: 0,
      category: ''
    });
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price,
      barcode: product.barcode || '',
      currentStock: product.currentStock,
      minStock: product.minStock,
      category: product.category || ''
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setProcessing(true);
    try {
      await deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete product. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || productForm.price <= 0) return;

    setProcessing(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productForm);
        setProducts(products.map(p => 
          p.id === editingProduct.id 
            ? { ...p, ...productForm, updatedAt: new Date() }
            : p
        ));
        alert('Product updated successfully!');
      } else {
        const newProductId = await addProduct(productForm);
        const newProduct: Product = {
          id: newProductId,
          ...productForm,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setProducts([...products, newProduct]);
        alert('Product added successfully!');
      }
      setShowProductModal(false);
    } catch (error) {
      console.error('Product save failed:', error);
      alert('Failed to save product. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(notifications.map(n => 
          n.id === notification.id ? { ...n, isRead: true } : n
        ));
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
              <BarChart3 className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Owner Dashboard</h1>
                <p className="text-gray-600">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-orange-600 transition-colors"
                >
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
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
                        notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${!notification.isRead ? 'bg-blue-50' : ''}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start">
                              {notification.type === 'low-stock' && <AlertTriangle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />}
                              {notification.type === 'sales' && <TrendingUp className="w-5 h-5 text-green-500 mr-3 mt-0.5" />}
                              {notification.type === 'stock-update' && <Package className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />}
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
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'overview' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-5 h-5 mr-3" />
              Dashboard Overview
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'inventory' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Package className="w-5 h-5 mr-3" />
              Inventory Management
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'reports' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-5 h-5 mr-3" />
              Sales Reports
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'logs' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Activity className="w-5 h-5 mr-3" />
              Transaction Logs
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Dashboard Overview */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Business Overview</h2>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Today's Sales</p>
                      <p className="text-2xl font-bold text-green-600">
                        ₱{(salesData.today.amount * 1.12).toFixed(2)}
                        </p>
                      <p className="text-sm text-gray-500">{salesData.today.transactions} transactions</p>
                    </div>
                    <span className="w-8 h-8 flex items-center justify-center text-green-600 text-3xl font-bold">₱</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Week's Sales</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ₱{(salesData.week.amount * 1.12).toFixed(2)}
                        </p>
                      <p className="text-sm text-gray-500">{salesData.week.transactions} transactions</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Month's Sales</p>
                      <p className="text-2xl font-bold text-purple-600">
                        ₱{(salesData.month.amount * 1.12).toFixed(2)}
                        </p>
                      <p className="text-sm text-gray-500">{salesData.month.transactions} transactions</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Low Stock Items</p>
                      <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
                      <p className="text-sm text-gray-500">Need attention</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-4">Top Selling Products</h3>
                <div className="space-y-4">
                  {topProducts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No sales data available</p>
                  ) : (
                    topProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.sold} units sold</p>
                        </div>
                        <p className="font-semibold text-green-600">₱{product.revenue.toFixed(2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Inventory Management */}
          {activeTab === 'inventory' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Inventory Management</h2>
                <button
                  onClick={handleAddProduct}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <div className="space-y-4">
                    {products.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No products available</p>
                    ) : (
                      products.map(product => (
                        <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">Barcode: {product.barcode}</p>
                            <div className="flex items-center mt-1 space-x-4">
                              <span className="text-sm text-gray-600">
                                Stock: {product.currentStock} / Min: {product.minStock}
                              </span>
                              <span className="text-sm font-semibold text-green-600">
                                ₱{product.price.toFixed(2)}
                              </span>
                              {product.currentStock < product.minStock && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                                  Low Stock
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                              disabled={processing}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sales Reports */}
          {activeTab === 'reports' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Sales Reports</h2>
                <button 
                  onClick={exportToPDF}
                  disabled={!reportData}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <label className="text-sm font-medium">Date Range:</label>
                  </div>
                  <input
                    type="date"
                    value={reportDateRange.startDate}
                    onChange={(e) => setReportDateRange({...reportDateRange, startDate: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={reportDateRange.endDate}
                    onChange={(e) => setReportDateRange({...reportDateRange, endDate: e.target.value})}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={generateDetailedReport}
                    disabled={loadingReport}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    {loadingReport ? 'Generating...' : 'Generate Report'}
                  </button>
                </div>
              </div>

              {reportData && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                      <p className="text-2xl font-bold text-green-600">₱{reportData.totalSales.toFixed(2)}</p>
                      <p className="text-gray-600">Total Sales</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                      <p className="text-2xl font-bold text-blue-600">{reportData.totalTransactions}</p>
                      <p className="text-gray-600">Total Transactions</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                      <p className="text-2xl font-bold text-purple-600">₱{reportData.averageTransaction.toFixed(2)}</p>
                      <p className="text-gray-600">Average Transaction</p>
                    </div>
                  </div>

                  {/* Top Products */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold mb-4">Top Selling Products</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Product Name</th>
                            <th className="text-right py-2">Quantity Sold</th>
                            <th className="text-right py-2">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.topProducts.map((product, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{product.name}</td>
                              <td className="text-right py-2">{product.quantitySold}</td>
                              <td className="text-right py-2 font-semibold">₱{product.revenue.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Daily Breakdown */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold mb-4">Daily Sales Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Date</th>
                            <th className="text-right py-2">Transactions</th>
                            <th className="text-right py-2">Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.dailyBreakdown.map((day, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                              <td className="text-right py-2">{day.transactions}</td>
                              <td className="text-right py-2 font-semibold">₱{day.sales.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cashier Performance */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold mb-4">Cashier Performance</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Cashier Name</th>
                            <th className="text-right py-2">Transactions</th>
                            <th className="text-right py-2">Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.cashierPerformance.map((cashier, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{cashier.cashierName}</td>
                              <td className="text-right py-2">{cashier.transactions}</td>
                              <td className="text-right py-2 font-semibold">₱{cashier.sales.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {!reportData && (
                <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                  <p className="text-gray-500">Select a date range and click "Generate Report" to view detailed sales analytics.</p>
                </div>
              )}
            </div>
          )}

          {/* Transaction Logs */}
          {activeTab === 'logs' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Transaction Logs</h2>
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No transactions available</p>
                  ) : (
                    transactions.slice(0, 20).map(transaction => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{transaction.cashierName} - Transaction Completed</p>
                          <p className="text-sm text-gray-500">
                            {transaction.items.length} items - ₱{(transaction.total * 1.12).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <p className="text-sm text-gray-400">
                            {transaction.timestamp.toLocaleDateString()} {transaction.timestamp.toLocaleTimeString()}
                          </p>
                          <button
                            onClick={() => exportTransactionPDF(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                            title="Download Receipt"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg" 
                  value={productForm.name}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full p-3 border rounded-lg" 
                  value={productForm.price || ''}
                  onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg" 
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-lg" 
                    value={productForm.currentStock || ''}
                    onChange={(e) => setProductForm({...productForm, currentStock: parseInt(e.target.value) || 0})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-lg" 
                    value={productForm.minStock || ''}
                    onChange={(e) => setProductForm({...productForm, minStock: parseInt(e.target.value) || 0})}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg" 
                  value={productForm.category}
                  onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                />
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {processing ? 'Saving...' : (editingProduct ? 'Update' : 'Create')} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;