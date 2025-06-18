import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Transaction, StockMovement, Notification, DailyReport, Receipt } from '../types';

// Products
export const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'products'), {
    ...product,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
};

export const updateProduct = async (id: string, updates: Partial<Product>) => {
  await updateDoc(doc(db, 'products', id), {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const deleteProduct = async (id: string) => {
  await deleteDoc(doc(db, 'products', id));
};

export const getProducts = async (): Promise<Product[]> => {
  const querySnapshot = await getDocs(collection(db, 'products'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate()
  })) as Product[];
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const docSnap = await getDoc(doc(db, 'products', id));
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate()
    } as Product;
  }
  return null;
};

// Transactions
export const addTransaction = async (transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
  const batch = writeBatch(db);
  
  // Add transaction
  const transactionRef = doc(collection(db, 'transactions'));
  batch.set(transactionRef, {
    ...transaction,
    timestamp: Timestamp.now()
  });
  
  // Update product stock and check for low stock
  const lowStockProducts: string[] = [];
  
  for (const cartItem of transaction.items) {
    // First, get the current product data to ensure we have the latest stock info
    const productDoc = await getDoc(doc(db, 'products', cartItem.id));
    if (!productDoc.exists()) {
      console.error(`Product ${cartItem.id} not found`);
      continue;
    }
    
    const productData = productDoc.data() as Product;
    const currentStock = typeof productData.currentStock === 'number' ? productData.currentStock : 0;
    const newStock = currentStock - cartItem.quantity;
    
    // Update the product stock
    const productRef = doc(db, 'products', cartItem.id);
    batch.update(productRef, {
      currentStock: Math.max(0, newStock),
      updatedAt: Timestamp.now()
    });
    
    // Check if product will be low stock after transaction
    if (newStock <= productData.minStock && newStock > 0) {
      lowStockProducts.push(productData.name);
    }
  }
  
  await batch.commit();

  // Send notifications (do not block transaction if these fail)
  try {
    await Promise.all([
    // Notify owner about transaction
    addNotification({
      type: 'sales',
      title: 'New Transaction Completed',
      message: `Transaction of ₱${(transaction.total * 1.12).toFixed(2)} completed by ${transaction.cashierName}`,
      isRead: false,
      userId: null, // Send to all owners
      targetRoles: ['owner']
    }),
    
    // Notify checker about transaction
    addNotification({
      type: 'sales',
      title: 'Transaction Processed',
      message: `Stock levels updated after transaction by ${transaction.cashierName}`,
      isRead: false,
      userId: null,
      targetRoles: ['checker']
    }),
    
    // Send low stock alerts if any
    ...(lowStockProducts.length > 0 ? [
      addNotification({
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: `Items running low after transaction: ${lowStockProducts.join(', ')}`,
        isRead: false,
        userId: null,
        targetRoles: ['owner', 'checker']
      })
    ] : [])
  ]);
  } catch (err) {
    // Log but ignore notification errors so cashier flow continues
    console.error('Notification creation failed:', err);
  }
  
  return transactionRef.id;
};

export const getTransactions = async (cashierId?: string): Promise<Transaction[]> => {
  let q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
  
  if (cashierId) {
    q = query(collection(db, 'transactions'), where('cashierId', '==', cashierId), orderBy('timestamp', 'desc'));
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  })) as Transaction[];
};

export const getTransactionsByDateRange = async (startDate: Date, endDate: Date): Promise<Transaction[]> => {
  const q = query(
    collection(db, 'transactions'),
    where('timestamp', '>=', Timestamp.fromDate(startDate)),
    where('timestamp', '<=', Timestamp.fromDate(endDate)),
    orderBy('timestamp', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  })) as Transaction[];
};

// Stock Movements
export const addStockMovement = async (movement: Omit<StockMovement, 'id' | 'timestamp'>) => {
  const docRef = await addDoc(collection(db, 'stockMovements'), {
    ...movement,
    timestamp: Timestamp.now()
  });
  
  // Update product stock based on movement type
  const product = await getProduct(movement.productId);
  if (product) {
    let newStock = product.currentStock;
    
    switch (movement.type) {
      case 'in':
        newStock += movement.quantity;
        break;
      case 'out':
      case 'damaged':
      case 'returned':
        newStock -= movement.quantity;
        break;
    }
    
    await updateProduct(movement.productId, { currentStock: Math.max(0, newStock) });
    
    // Send notifications about stock updates
    await Promise.all([
      // Notify owner
      addNotification({
        type: 'stock-update',
        title: 'Stock Updated',
        message: `${movement.productName} stock ${movement.type === 'in' ? 'increased' : 'decreased'} by ${movement.quantity} units by ${movement.checkerName}`,
        isRead: false,
        userId: null,
        targetRoles: ['owner']
      }),
      
      // Notify cashiers about stock changes
      addNotification({
        type: 'stock-update',
        title: 'Inventory Updated',
        message: `${movement.productName} stock levels have been updated`,
        isRead: false,
        userId: null,
        targetRoles: ['cashier']
      })
    ]);
  }
  
  return docRef.id;
};

export const getStockMovements = async (): Promise<StockMovement[]> => {
  const q = query(collection(db, 'stockMovements'), orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  })) as StockMovement[];
};

// Receipts
export const addReceipt = async (receipt: Omit<Receipt, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, 'receipts'), {
    ...receipt,
    createdAt: Timestamp.now()
  });
  return docRef.id;
};

// Notifications
export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, 'notifications'), {
    ...notification,
    createdAt: Timestamp.now()
  });
  return docRef.id;
};

export const getNotifications = async (userRole?: string): Promise<Notification[]> => {
  let q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
  
  if (userRole) {
    q = query(
      collection(db, 'notifications'),
      where('targetRoles', 'array-contains', userRole),
      orderBy('createdAt', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate()
  })) as Notification[];
};

export const markNotificationAsRead = async (id: string) => {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
};

// Real-time listeners
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  return onSnapshot(collection(db, 'products'), (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as Product[];
    callback(products);
  });
};

export const subscribeToNotifications = (userRole: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications'),
    where('targetRoles', 'array-contains', userRole),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    })) as Notification[];
    callback(notifications);
  });
};