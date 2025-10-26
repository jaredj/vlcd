declare module 'firebase/app' {
  export interface FirebaseApp {
    readonly name?: string;
  }

  export type FirebaseOptions = Record<string, unknown>;

  export function getApp(): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function initializeApp(options: FirebaseOptions): FirebaseApp;
}

declare module 'firebase/firestore' {
  export type DocumentData = Record<string, unknown>;

  export interface Firestore {
    readonly app?: import('firebase/app').FirebaseApp;
  }

  export interface DocumentReference<T = DocumentData> {
    readonly id: string;
    readonly path: string;
    readonly __type?: T;
  }

  export interface DocumentSnapshot<T = DocumentData> {
    exists(): boolean;
    data(): T | undefined;
  }

  export function getFirestore(app: import('firebase/app').FirebaseApp): Firestore;
  export function doc<T = DocumentData>(
    db: Firestore,
    collectionPath: string,
    documentPath: string
  ): DocumentReference<T>;
  export function getDoc<T = DocumentData>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  export function setDoc<T = DocumentData>(reference: DocumentReference<T>, data: T): Promise<void>;
  export function updateDoc<T = DocumentData>(reference: DocumentReference<T>, data: Partial<T>): Promise<void>;
  export function deleteDoc(reference: DocumentReference<unknown>): Promise<void>;
}
