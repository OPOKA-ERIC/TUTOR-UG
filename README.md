# TutorUG — Uganda's Smart Learning Companion

AI-Powered Localized Education Platform for Uganda  
**Primary • Secondary • University • Professional**  
**135+ Districts | Voice-Enabled | Document Learning | Adaptive Quizzing**

---

## 🚀 Quick Start

### Prerequisites
- Android Studio Hedgehog or later
- JDK 17+
- Firebase account
- Anthropic Claude API key

### Setup Instructions

1. **Clone and Open Project**
   ```bash
   cd d:\TutorUG\TutorUG_App
   ```
   Open in Android Studio

2. **Firebase Setup**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Storage
   - Enable Cloud Functions
   - Download `google-services.json` and place in `app/` folder

3. **Configure Anthropic API**
   ```bash
   firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY"
   ```

4. **Deploy Cloud Functions**
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

5. **Run the App**
   - Connect Android device or start emulator
   - Click Run ▶ in Android Studio

---

## 📱 Features Implemented

✅ **Phase 1 — Core Features**
- Firebase Authentication (Email/Password)
- Student Profile with District Selection
- 135+ Uganda Districts Database
- AI Chat with Localized Context
- Voice Input (Speech-to-Text)
- Voice Output (Text-to-Speech)
- Material 3 Design with Uganda Theme (Black/Gold/Red)
- Chat History
- Subject Sidebar Navigation

✅ **Phase 2 — Document & Quiz**
- Document Upload (PDF, Images)
- ML Kit OCR for handwritten notes
- Section-by-section learning flow
- Adaptive Quiz Engine (70% pass threshold)
- Quiz results tracking
- Progress dashboard

🔄 **Phase 3 — Coming Soon**
- Teacher Dashboard
- Offline Mode
- Multi-language Support (Luganda, Acholi, Runyankole)

---

## 🏗️ Architecture

```
TutorUG_App/
├── app/
│   ├── src/main/
│   │   ├── java/com/tutorug/app/
│   │   │   ├── data/
│   │   │   │   ├── model/          # Data models
│   │   │   │   ├── repository/     # Firebase repositories
│   │   │   │   └── local/          # District database
│   │   │   ├── ui/
│   │   │   │   ├── screens/        # All UI screens
│   │   │   │   └── theme/          # Uganda theme colors
│   │   │   ├── viewmodel/          # ViewModels
│   │   │   ├── util/               # Voice, Constants
│   │   │   ├── MainActivity.kt
│   │   │   └── TutorUGApp.kt
│   │   ├── res/
│   │   │   ├── raw/
│   │   │   │   └── districts.json  # 135+ districts
│   │   │   └── values/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── functions/
│   ├── index.js                    # Claude API integration
│   └── package.json
├── firestore.rules
├── storage.rules
└── firebase.json
```

---

## 🎨 Screens

1. **Splash Screen** — Uganda flag colors with gold glow
2. **Login Screen** — Email/password with gold CTA
3. **Register Screen** — Multi-step with district & level selection
4. **Chat Screen** — AI tutor with voice I/O, sidebar navigation
5. **Document Upload** — Drag-drop with subject selection
6. **Quiz Screen** — Multiple choice with local context questions
7. **Settings Screen** — Profile, voice settings, logout

---

## 🔐 Security

- Firebase Authentication with JWT tokens
- Firestore Security Rules (user data isolation)
- Storage Rules (private document access)
- API keys secured in Cloud Functions (never exposed in app)
- All data encrypted in transit (HTTPS/TLS) and at rest (AES-256)

---

## 💰 Cost Estimate

**MVP Phase (0-500 users):**
- Anthropic Claude API: $60-$360/month
- Firebase: $2-$10/month
- **Total: $60-$400/month**

**Growth Phase (1,000+ daily users):**
- Anthropic Claude API: $600-$3,600/month
- Firebase: $10-$50/month
- **Total: $600-$4,000/month**

---

## 📞 Support

**Founding Team:**
- Opoka Eric — Co-Founder
- Ojok Erick — Co-Founder
- Opeto Isaac — Co-Founder
- Maniragaba Brian — Co-Founder

**Contact:** info@tutorug.com

---

© 2025 TutorUG | Uganda's Smart Learning Companion 🇺🇬
