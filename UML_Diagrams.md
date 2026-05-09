# TutorUG — UML Diagrams

---

## 1. USE CASE DIAGRAM

```mermaid
graph TD
    subgraph Actors
        S((Student))
        T((Teacher\nPhase 3))
        SYS((System\nSupabase +\nClaude AI))
    end

    subgraph Authentication
        UC1[Register Account]
        UC2[Login]
        UC3[Forgot Password / OTP]
        UC4[Change Password]
    end

    subgraph Profile & Settings
        UC5[Select District & Region]
        UC6[Select Education Level]
        UC7[Set School / Combination / Course]
        UC8[Update Avatar]
        UC9[Configure Voice Settings]
        UC10[Set App Theme]
        UC11[Set Study Reminders]
    end

    subgraph AI Tutoring
        UC12[Start Chat Session]
        UC13[Send Text Message]
        UC14[Use Voice Input]
        UC15[Listen to Voice Output]
        UC16[Select Subject]
        UC17[View Chat History]
    end

    subgraph Document Learning
        UC18[Upload PDF / Image]
        UC19[OCR Text Extraction]
        UC20[View Document Sections]
        UC21[Study Section Content]
        UC22[Track Section Progress]
    end

    subgraph Quiz Engine
        UC23[Take Adaptive Quiz]
        UC24[Submit Answers]
        UC25[View Score & Explanations]
        UC26[Retry Failed Quiz]
        UC27[View Quiz History]
    end

    subgraph Timetable
        UC28[Create Study Schedule]
        UC29[Set Alarm Reminders]
        UC30[Log Study Session]
        UC31[View Study Insights]
    end

    subgraph Progress
        UC32[View Learning Dashboard]
        UC33[Track Streak Days]
        UC34[View Document Scores]
    end

    S --> UC1
    S --> UC2
    S --> UC3
    S --> UC4
    S --> UC5
    S --> UC6
    S --> UC7
    S --> UC8
    S --> UC9
    S --> UC10
    S --> UC11
    S --> UC12
    S --> UC13
    S --> UC14
    S --> UC15
    S --> UC16
    S --> UC17
    S --> UC18
    S --> UC20
    S --> UC21
    S --> UC23
    S --> UC24
    S --> UC25
    S --> UC26
    S --> UC27
    S --> UC28
    S --> UC29
    S --> UC30
    S --> UC31
    S --> UC32
    S --> UC33
    S --> UC34

    SYS --> UC19
    SYS --> UC14
    SYS --> UC15

    T --> UC32
    T --> UC27
```

---

## 2. CLASS DIAGRAM

```mermaid
classDiagram

    class UserProfile {
        +String userId
        +String name
        +String email
        +String district
        +String region
        +String educationLevel
        +String school
        +String combination
        +String course
        +String profession
        +String avatarUrl
        +Int totalMessages
        +Int totalQuizzes
        +Int totalDocuments
        +Int streakDays
        +String lastStreakDate
        +String createdAt
        +String lastActive
    }

    class UserSettings {
        +String userId
        +Boolean voiceEnabled
        +Boolean autoReadEnabled
        +Boolean quizSoundEnabled
        +Boolean notificationsEnabled
        +Boolean studyRemindersEnabled
        +String quizDifficulty
        +String appTheme
        +String language
        +String updatedAt
    }

    class ChatSession {
        +String sessionId
        +String userId
        +String subject
        +String educationLevel
        +String title
        +Int messageCount
        +String startedAt
        +String lastMessageAt
        +String documentId
        +Int sectionIndex
    }

    class ChatMessage {
        +String messageId
        +String sessionId
        +String userId
        +String role
        +String content
        +Int tokenCount
        +String createdAt
    }

    class UploadedDocument {
        +String documentId
        +String userId
        +String fileName
        +String storageUrl
        +String mimeType
        +Int fileSizeKb
        +String subject
        +String educationLevel
        +String status
        +Int overallScore
        +Int sectionCount
        +String uploadedAt
        +String processedAt
    }

    class DocumentSection {
        +String sectionId
        +String documentId
        +String userId
        +Int sectionIndex
        +String title
        +String content
        +Boolean quizPassed
        +Int bestScore
        +Int attemptCount
        +String createdAt
    }

    class QuizResult {
        +String quizId
        +String userId
        +String documentId
        +String sectionId
        +String sectionTitle
        +String subject
        +String educationLevel
        +Int score
        +Int totalQuestions
        +Int correctAnswers
        +Boolean passed
        +String difficulty
        +Int timeTakenSec
        +String takenAt
    }

    class QuizQuestion {
        +String question
        +List~String~ options
        +Int correctIndex
        +String explanation
    }

    class TimetableEntry {
        +String entryId
        +String userId
        +String subject
        +Int dayOfWeek
        +Int startHour
        +Int startMin
        +Int endHour
        +Int endMin
        +String colorHex
        +String createdAt
    }

    class StudySessionLog {
        +String logId
        +String userId
        +String entryId
        +String subject
        +Int dayOfWeek
        +Int scheduledMins
        +Int attendedMins
        +Boolean alarmFired
        +String dateStr
        +String createdAt
    }

    class DistrictData {
        +String name
        +String region
        +List~String~ places
        +List~String~ localNames
        +List~String~ landmarks
        +List~String~ foods
        +List~String~ economy
    }

    class AuthRepository {
        +signIn(email, password)
        +signUp(email, password)
        +signOut()
        +sendOtp(email)
        +verifyOtp(email, token)
        +resetPassword(newPassword)
    }

    class ChatRepository {
        +createSession(userId, subject) ChatSession
        +sendMessage(sessionId, message) Flow
        +getSessionMessages(sessionId) List~ChatMessage~
        +getUserSessions(userId) List~ChatSession~
        +deleteSession(sessionId)
    }

    class DocumentRepository {
        +uploadDocument(uri, subject) UploadedDocument
        +getUserDocuments(userId) List~UploadedDocument~
        +getDocumentSections(documentId) List~DocumentSection~
        +deleteDocument(documentId)
    }

    class QuizRepository {
        +generateQuiz(sectionContent) List~QuizQuestion~
        +saveResult(result) QuizResult
        +getUserResults(userId) List~QuizResult~
    }

    class TimetableRepository {
        +addEntry(entry) TimetableEntry
        +getEntries(userId) List~TimetableEntry~
        +deleteEntry(entryId)
        +logSession(log) StudySessionLog
        +getInsights(userId) List~StudyInsight~
    }

    class AuthViewModel {
        +uiState: StateFlow
        +login(email, password)
        +register(profile)
        +logout()
        +sendOtp(email)
        +verifyOtp(token)
    }

    class ChatViewModel {
        +sessions: StateFlow
        +messages: StateFlow
        +sendMessage(text)
        +startNewSession(subject)
        +loadHistory(sessionId)
        +toggleVoice()
    }

    class DocumentViewModel {
        +documents: StateFlow
        +sections: StateFlow
        +uploadDocument(uri, subject)
        +loadSections(documentId)
        +deleteDocument(id)
    }

    class QuizViewModel {
        +questions: StateFlow
        +currentIndex: StateFlow
        +score: StateFlow
        +loadQuiz(sectionContent)
        +submitAnswer(index)
        +finishQuiz()
    }

    class SettingsViewModel {
        +settings: StateFlow
        +updateVoice(enabled)
        +updateTheme(theme)
        +updateDifficulty(level)
        +saveSettings()
    }

    class TimetableViewModel {
        +entries: StateFlow
        +insights: StateFlow
        +addEntry(entry)
        +deleteEntry(id)
        +loadInsights()
    }

    class VoiceManager {
        +startListening()
        +stopListening()
        +speak(text)
        +stopSpeaking()
    }

    UserProfile "1" --> "1" UserSettings
    UserProfile "1" --> "*" ChatSession
    UserProfile "1" --> "*" UploadedDocument
    UserProfile "1" --> "*" QuizResult
    UserProfile "1" --> "*" TimetableEntry
    UserProfile "1" --> "*" StudySessionLog
    ChatSession "1" --> "*" ChatMessage
    UploadedDocument "1" --> "*" DocumentSection
    DocumentSection "1" --> "*" QuizResult
    QuizResult "*" --> "*" QuizQuestion

    AuthViewModel --> AuthRepository
    ChatViewModel --> ChatRepository
    DocumentViewModel --> DocumentRepository
    QuizViewModel --> QuizRepository
    SettingsViewModel --> AuthRepository
    TimetableViewModel --> TimetableRepository

    ChatViewModel --> VoiceManager
```

---

## 3. SEQUENCE DIAGRAMS

### 3a. User Registration

```mermaid
sequenceDiagram
    actor Student
    participant RegisterScreen
    participant AuthViewModel
    participant AuthRepository
    participant SupabaseAuth
    participant SupabaseDB

    Student->>RegisterScreen: Enter name, email, password
    Student->>RegisterScreen: Select district, region, education level
    Student->>RegisterScreen: Tap Register
    RegisterScreen->>AuthViewModel: register(profile)
    AuthViewModel->>AuthRepository: signUp(email, password)
    AuthRepository->>SupabaseAuth: auth.signUp()
    SupabaseAuth-->>AuthRepository: userId
    AuthRepository->>SupabaseDB: INSERT INTO users (userId, name, district...)
    SupabaseDB-->>AuthRepository: success
    AuthRepository->>SupabaseDB: INSERT INTO user_settings (userId, defaults)
    SupabaseDB-->>AuthRepository: success (trigger auto-creates row)
    AuthRepository-->>AuthViewModel: UserProfile
    AuthViewModel-->>RegisterScreen: navigateToChatScreen
```

---

### 3b. AI Chat with Voice

```mermaid
sequenceDiagram
    actor Student
    participant ChatScreen
    participant VoiceManager
    participant ChatViewModel
    participant ChatRepository
    participant SupabaseFunction
    participant ClaudeAPI

    Student->>ChatScreen: Tap mic button
    ChatScreen->>VoiceManager: startListening()
    VoiceManager-->>ChatScreen: recognizedText
    ChatScreen->>ChatViewModel: sendMessage(text)
    ChatViewModel->>ChatRepository: sendMessage(sessionId, text, history)
    ChatRepository->>SupabaseFunction: POST /send-chat-message
    SupabaseFunction->>ClaudeAPI: stream(messages, systemPrompt)
    ClaudeAPI-->>SupabaseFunction: SSE token stream
    SupabaseFunction-->>ChatRepository: SSE chunks
    ChatRepository-->>ChatViewModel: Flow<String> tokens
    ChatViewModel-->>ChatScreen: update UI token by token
    ChatScreen->>VoiceManager: speak(fullResponse)
    VoiceManager-->>Student: Audio playback
    ChatRepository->>SupabaseFunction: POST /send-chat-message (save to DB)
    Note over ChatRepository,SupabaseFunction: message saved to chat_messages table
```

---

### 3c. Document Upload & Processing

```mermaid
sequenceDiagram
    actor Student
    participant DocumentUploadScreen
    participant DocumentViewModel
    participant DocumentRepository
    participant MLKit
    participant SupabaseStorage
    participant SupabaseFunction
    participant ClaudeAPI
    participant SupabaseDB

    Student->>DocumentUploadScreen: Pick PDF/Image, select subject
    DocumentUploadScreen->>DocumentViewModel: uploadDocument(uri, subject)
    DocumentViewModel->>DocumentRepository: uploadDocument(uri, subject)
    DocumentRepository->>MLKit: extractText(uri)
    MLKit-->>DocumentRepository: extractedText
    DocumentRepository->>SupabaseStorage: upload file to documents bucket
    SupabaseStorage-->>DocumentRepository: storageUrl
    DocumentRepository->>SupabaseDB: INSERT INTO documents (status=processing)
    DocumentRepository->>SupabaseFunction: POST /process-document (text, documentId)
    SupabaseFunction->>ClaudeAPI: create sections from text
    ClaudeAPI-->>SupabaseFunction: JSON sections array
    SupabaseFunction->>SupabaseDB: INSERT INTO document_sections
    SupabaseFunction->>SupabaseDB: UPDATE documents SET status=ready
    SupabaseDB-->>DocumentViewModel: realtime update
    DocumentViewModel-->>DocumentUploadScreen: navigate to LearningScreen
```

---

### 3d. Adaptive Quiz Flow

```mermaid
sequenceDiagram
    actor Student
    participant LearningScreen
    participant QuizViewModel
    participant QuizRepository
    participant SupabaseFunction
    participant ClaudeAPI
    participant SupabaseDB

    Student->>LearningScreen: Tap Take Quiz
    LearningScreen->>QuizViewModel: loadQuiz(sectionContent)
    QuizViewModel->>QuizRepository: generateQuiz(sectionContent, userProfile)
    QuizRepository->>SupabaseFunction: POST /generate-quiz
    SupabaseFunction->>ClaudeAPI: generate 3-5 MCQ questions
    ClaudeAPI-->>SupabaseFunction: JSON questions array
    SupabaseFunction-->>QuizRepository: questions
    QuizRepository-->>QuizViewModel: List<QuizQuestion>
    QuizViewModel-->>LearningScreen: show QuizScreen

    loop Each Question
        Student->>LearningScreen: Select answer
        LearningScreen->>QuizViewModel: submitAnswer(index)
        QuizViewModel-->>LearningScreen: show correct/wrong + explanation
    end

    QuizViewModel->>QuizViewModel: calculateScore()
    alt score >= 70%
        QuizViewModel->>QuizRepository: saveResult(passed=true)
        QuizRepository->>SupabaseDB: INSERT INTO quiz_results
        SupabaseDB->>SupabaseDB: trigger updates section best_score, quiz_passed=true
        QuizViewModel-->>LearningScreen: show Pass screen, unlock next section
    else score < 70%
        QuizViewModel->>QuizRepository: saveResult(passed=false)
        QuizRepository->>SupabaseDB: INSERT INTO quiz_results
        QuizViewModel-->>LearningScreen: show Retry option
    end
```

---

## 4. ACTIVITY DIAGRAMS

### 4a. Full App Navigation Flow

```mermaid
flowchart TD
    A([App Launch]) --> B[SplashScreen]
    B --> C{User Logged In?}
    C -- No --> D[LoginScreen]
    C -- Yes --> E[ChatScreen]

    D --> F{Has Account?}
    F -- No --> G[RegisterScreen]
    F -- Yes --> H[Enter Email & Password]

    G --> G1[Enter Name & Email]
    G1 --> G2[Select District & Region]
    G2 --> G3[Select Education Level]
    G3 --> G4{Level?}
    G4 -- S5/S6 --> G5[Enter Combination e.g. PCB]
    G4 -- University --> G6[Enter Course]
    G4 -- Professional --> G7[Enter Profession]
    G4 -- Primary/OLevel --> G8[Enter School]
    G5 & G6 & G7 & G8 --> G9[Set Password]
    G9 --> E

    H --> I{Auth OK?}
    I -- No --> J[Show Error]
    J --> D
    I -- Yes --> E

    E --> K{User Action}
    K -- Select Subject --> L[New Chat Session]
    K -- Upload Doc --> M[DocumentUploadScreen]
    K -- Timetable --> N[TimetableScreen]
    K -- Progress --> O[LearningProgressScreen]
    K -- Settings --> P[SettingsScreen]

    M --> Q[Pick File & Subject]
    Q --> R[OCR Extraction]
    R --> S[AI Processes Sections]
    S --> T[LearningScreen]
    T --> U[Read Section]
    U --> V[Take Quiz]
    V --> W{Score >= 70%?}
    W -- Yes --> X{More Sections?}
    X -- Yes --> U
    X -- No --> Y[Document Complete]
    W -- No --> Z[Retry Quiz]
    Z --> V

    P --> P1{Action}
    P1 -- Forgot Password --> P2[ForgotPasswordScreen]
    P2 --> P3[OtpVerifyScreen]
    P3 --> P4[NewPasswordScreen]
    P1 -- Logout --> D
```

---

### 4b. Timetable & Study Reminder Flow

```mermaid
flowchart TD
    A([Open TimetableScreen]) --> B[Load Entries from Supabase]
    B --> C[Display Weekly Grid]
    C --> D{User Action}

    D -- Add Entry --> E[Select Subject]
    E --> F[Select Day of Week]
    F --> G[Set Start & End Time]
    G --> H[Pick Color]
    H --> I[Save to Supabase]
    I --> J[Schedule Alarm via AlarmManager]
    J --> C

    D -- Delete Entry --> K[Remove from Supabase]
    K --> L[Cancel Alarm]
    L --> C

    D -- View Insights --> M[Load StudySessionLogs]
    M --> N[Compute Insights per Subject]
    N --> O{InsightType}
    O -- GOOD --> P[Show green badge]
    O -- NEEDS_MORE_TIME --> Q[Show yellow badge]
    O -- MISSED --> R[Show red badge]
    O -- NO_DATA --> S[Show grey badge]

    subgraph Background
        T([Alarm Fires]) --> U[TimetableAlarmReceiver]
        U --> V[Show Notification]
        V --> W[Student Opens App]
        W --> X[Log attendedMins to Supabase]
    end
```

---

## 5. COMPONENT DIAGRAM

```mermaid
graph TD
    subgraph Android App
        subgraph UI Layer
            S1[SplashScreen]
            S2[LoginScreen]
            S3[RegisterScreen]
            S4[ChatScreen]
            S5[DocumentUploadScreen]
            S6[LearningScreen]
            S7[QuizScreen]
            S8[TimetableScreen]
            S9[LearningProgressScreen]
            S10[SettingsScreen]
        end

        subgraph ViewModel Layer
            VM1[AuthViewModel]
            VM2[ChatViewModel]
            VM3[DocumentViewModel]
            VM4[QuizViewModel]
            VM5[TimetableViewModel]
            VM6[SettingsViewModel]
        end

        subgraph Repository Layer
            R1[AuthRepository]
            R2[ChatRepository]
            R3[DocumentRepository]
            R4[QuizRepository]
            R5[TimetableRepository]
            R6[StudySessionRepository]
        end

        subgraph Utilities
            U1[VoiceManager\nSpeechRecognizer + TTS]
            U2[AnthropicClient\nSSE streaming]
            U3[DistrictDatabase\nJSON local]
            U4[AlarmManager\nTimetableAlarmReceiver]
            U5[BootReceiver\nrestore alarms]
            U6[TutorUGMessagingService\nFCM push]
        end

        subgraph Data Layer
            D1[SupabaseClient\nPostgREST + Auth]
            D2[Models.kt\ndata classes]
        end
    end

    subgraph Supabase Cloud
        SB1[Supabase Auth\nJWT + OTP]
        SB2[Supabase DB\nPostgreSQL + RLS]
        SB3[Supabase Storage\ndocuments + avatars]
        subgraph Edge Functions
            EF1[send-chat-message]
            EF2[generate-quiz]
            EF3[process-document]
            EF4[send-otp]
            EF5[verify-otp]
            EF6[reset-password]
            EF7[send-reminder]
        end
    end

    subgraph External APIs
        EX1[Anthropic Claude API\nclaude-haiku / sonnet]
        EX2[Google ML Kit\nOCR text extraction]
        EX3[Android SpeechRecognizer\nvoice input]
        EX4[Android TTS\nvoice output]
    end

    S2 & S3 --> VM1
    S4 --> VM2
    S5 --> VM3
    S6 & S7 --> VM4
    S8 --> VM5
    S10 --> VM6

    VM1 --> R1
    VM2 --> R2
    VM3 --> R3
    VM4 --> R4
    VM5 --> R5
    VM6 --> R1

    VM2 --> U1
    VM2 --> U2

    R1 --> D1
    R2 --> D1
    R3 --> D1
    R4 --> D1
    R5 --> D1
    R6 --> D1

    D1 --> SB1
    D1 --> SB2
    D1 --> SB3

    R2 --> EF1
    R4 --> EF2
    R3 --> EF3
    R1 --> EF4
    R1 --> EF5
    R1 --> EF6

    EF1 --> EX1
    EF2 --> EX1
    EF3 --> EX1

    R3 --> EX2
    U1 --> EX3
    U1 --> EX4

    U4 --> SB2
    U6 --> SB2
```

---

## 6. DEPLOYMENT DIAGRAM

```mermaid
graph TD
    subgraph Student Device Android
        APP[TutorUG APK]
        MLKIT[ML Kit OCR\nOn-device]
        STT[SpeechRecognizer\nOn-device]
        TTS[TextToSpeech\nOn-device]
        ALARM[AlarmManager\nOn-device]
        LOCALDB[districts.json\nLocal Asset]
    end

    subgraph Supabase Cloud Platform
        subgraph Auth Service
            AUTH[GoTrue Auth\nEmail + OTP + JWT]
        end
        subgraph Database
            PG[PostgreSQL\nusers, chat_sessions,\nchat_messages, documents,\ndocument_sections,\nquiz_results, timetable_entries,\nstudy_session_logs,\nuser_settings]
            RLS[Row Level Security\nper-user isolation]
        end
        subgraph Storage
            BUCKET1[documents bucket\nprivate]
            BUCKET2[avatars bucket\npublic read]
        end
        subgraph Edge Functions Deno
            EF1[send-chat-message\nSSE streaming]
            EF2[generate-quiz\nMCQ generation]
            EF3[process-document\nsection extraction]
            EF4[send-otp]
            EF5[verify-otp]
            EF6[reset-password]
            EF7[send-reminder]
        end
    end

    subgraph Anthropic Cloud
        CLAUDE1[claude-haiku-4-5\nchat + document processing]
        CLAUDE2[claude-sonnet-4\nquiz generation]
    end

    subgraph Google Cloud
        FCM[Firebase Cloud Messaging\npush notifications]
    end

    APP -- HTTPS REST --> AUTH
    APP -- HTTPS REST PostgREST --> PG
    APP -- HTTPS --> BUCKET1
    APP -- HTTPS --> BUCKET2
    APP -- HTTPS SSE --> EF1
    APP -- HTTPS --> EF2
    APP -- HTTPS --> EF3
    APP -- HTTPS --> EF4
    APP -- HTTPS --> EF5
    APP -- HTTPS --> EF6

    EF1 -- HTTPS --> CLAUDE1
    EF2 -- HTTPS --> CLAUDE2
    EF3 -- HTTPS --> CLAUDE1

    EF7 -- HTTPS --> FCM
    FCM -- Push --> APP

    APP --> MLKIT
    APP --> STT
    APP --> TTS
    APP --> ALARM
    APP --> LOCALDB

    PG --> RLS
```
