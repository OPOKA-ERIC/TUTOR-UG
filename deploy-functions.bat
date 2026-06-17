@echo off
echo ============================================
echo  TutorUG — Deploy All Edge Functions
echo ============================================
echo.

cd /d "%~dp0"

echo Step 1: Deploying send-chat-message...
.\supabase functions deploy send-chat-message --no-verify-jwt
echo.

echo Step 2: Deploying moderate-message...
.\supabase functions deploy moderate-message --no-verify-jwt
echo.

echo Step 3: Deploying generate-podcast...
.\supabase functions deploy generate-podcast --no-verify-jwt
echo.

echo Step 4: Deploying create-meeting...
.\supabase functions deploy create-meeting --no-verify-jwt
echo.

echo Step 5: Deploying generate-quiz...
.\supabase functions deploy generate-quiz --no-verify-jwt
echo.

echo Step 6: Deploying process-document...
.\supabase functions deploy process-document --no-verify-jwt
echo.

echo ============================================
echo  ALL FUNCTIONS DEPLOYED!
echo ============================================
echo.
echo NEXT: Set your secrets in Supabase dashboard:
echo   Settings ^> Edge Functions ^> Secrets
echo   ANTHROPIC_KEY = your-anthropic-api-key
echo   DAILY_API_KEY = your-daily-co-key (optional for meetings)
echo.
pause
