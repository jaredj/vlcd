import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyASGUwmIn0YMh0wirh3PHOlHX-ZLDO5XII',
  authDomain: 'vlcd-lab.firebaseapp.com',
  projectId: 'vlcd-lab',
  storageBucket: 'vlcd-lab.firebasestorage.app',
  messagingSenderId: '646254735126',
  appId: '1:646254735126:web:1424ce7c2efe7cba6d2a37',
  measurementId: 'G-E6Z6SW5FCB'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const firestore = getFirestore(app);

export { app };
