# TutorUG Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Name it: `tutorug-app`
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Add Android App

1. In Firebase Console, click Android icon
2. Android package name: `com.tutorug.app`
3. App nickname: `TutorUG`
4. Download `google-services.json`
5. Place it in `TutorUG_App/app/` folder

## Step 3: Enable Firebase Services

### Authentication
1. Go to Authentication → Get Started
2. Enable "Email/Password"
3. Enable "Google" (optional)

### Firestore Database
1. Go to Firestore Database → Create Database
2. Start in **Production mode**
3. Choose location: `us-central` or closest to Uganda
4. Deploy the `firestore.rules` file:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Storage
1. Go to Storage → Get Started
2. Start in **Production mode**
3. Deploy the `storage.rules` file:
   ```bash
   firebase deploy --only storage
   ```

### Cloud Functions
1. Upgrade to Blaze (Pay as you go) plan
2. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
3. Login:
   ```bash
   firebase login
   ```
4. Set Anthropic API key:
   ```bash
   firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY_HERE"
   ```
5. Deploy functions:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

## Step 4: Get Anthropic API Key

1. Go to https://console.anthropic.com
2. Create account or login
3. Go to API Keys
4. Create new key
5. Copy the key (starts with `sk-ant-...`)
6. Use it in the Firebase config command above

## Step 5: Build & Run

1. Open project in Android Studio
2. Wait for Gradle sync
3. Connect Android device or start emulator
4. Click Run ▶

---

## Firestore Collections Structure

```
users/
  {userId}/
    - name, email, district, educationLevel, school, region, createdAt, lastActive

chatSessions/
  {sessionId}/
    - userId, subject, educationLevel, startedAt, messages[]

documents/
  {documentId}/
    - userId, fileName, storageURL, subject, uploadedAt, sections[], overallScore, status

quizResults/
  {quizId}/
    - userId, documentId, section, score, passed, timestamp

progress/
  {progressId}/
    - userId, subject, totalSessions, totalQuizzes, averageScore, lastStudied
```

---

## Testing the App

1. **Register a new student:**
   - Name: Akello
   - Email: akello@test.com
   - Password: test1234
   - District: Gulu
   - Level: S3

2. **Start a chat:**
   - Select "Mathematics" from sidebar
   - Ask: "Explain profit and loss"
   - AI will respond using Gulu Main Market examples

3. **Test voice:**
   - Tap microphone button
   - Speak: "What is photosynthesis?"
   - AI reads response aloud

4. **Upload document:**
   - Tap upload icon
   - Select a PDF or image
   - Choose subject
   - AI breaks it into sections and quizzes you

---

## Troubleshooting

**Build fails:**
- Ensure `google-services.json` is in `app/` folder
- Run `./gradlew clean build`

**Cloud Functions not working:**
- Check Firebase Console → Functions → Logs
- Verify Anthropic API key is set correctly
- Ensure Blaze plan is active

**Voice not working:**
- Grant microphone permission in Android settings
- Check device has Google Text-to-Speech installed

---

© 2025 TutorUG
