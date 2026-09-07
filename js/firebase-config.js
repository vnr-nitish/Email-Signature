// ============================================================================
// 1. Go to https://console.firebase.google.com -> Create a project.
// 2. In the project: Build > Authentication > Sign-in method > enable "Email/Password".
// 3. Build > Firestore Database > Create database (start in production mode).
// 4. Build > Storage > Get started (start in production mode).
// 5. Project settings (gear icon) > General > "Your apps" > Add app > Web (</>).
//    Copy the config object it gives you and paste the values below.
// 6. Paste the contents of firestore.rules and storage.rules into the
//    "Rules" tab of Firestore and Storage respectively in the console.
// ============================================================================
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};
