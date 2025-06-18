export interface Product {
  id: string;
  name: string;
  price: number;
  barcode?: string;
  currentStock: number;
  minStock: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  cashierId: string;
  cashierName: string;
  timestamp: Date;
  paymentMethod: 'cash' | 'card';
  status: 'completed' | 'held' | 'cancelled';
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'damaged' | 'returned';
  quantity: number;
  reason?: string;
  checkerId: string;
  checkerName: string;
  timestamp: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'cashier' | 'checker';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface Notification {
  id: string;
  type: 'low-stock' | 'sales' | 'price-change' | 'system' | 'stock-update';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  userId?: string | null;
  targetRoles: string[];
}

export interface DailyReport {
  id: string;
  date: string;
  totalSales: number;
  totalTransactions: number;
  cashierId?: string;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  createdAt: Date;
}

export interface Receipt {
  id: string;
  transactionId: string;
  content: string;
  createdAt: Date;
}

export interface SalesReportData {
  totalSales: number;
  totalTransactions: number;
  averageTransaction: number;
  topProducts: Array<{
    name: string;
    quantitySold: number;
    revenue: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    sales: number;
    transactions: number;
  }>;
  cashierPerformance: Array<{
    cashierName: string;
    sales: number;
    transactions: number;
  }>;
}