// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBiKTJavOTJU4mzjEcLnIm3i8558vlQ8To",
  authDomain: "hardware-1476e.firebaseapp.com",
  projectId: "hardware-1476e",
  storageBucket: "hardware-1476e.firebasestorage.app",
  messagingSenderId: "456770440543",
  appId: "1:456770440543:web:cd6a7d230f39c91686faea",
  measurementId: "G-V6VQ84EKN2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, analytics };
export default app;