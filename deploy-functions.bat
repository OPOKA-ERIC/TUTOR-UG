@echo off
echo ============================================
echo  TutorUG - Deploy All Edge Functions
echo ============================================
echo.
echo  NOTE: AI + meeting functions are deployed WITHOUT --no-verify-jwt
echo  so the Supabase gateway REQUIRES a valid Supabase JWT.
echo  This stops anonymous users from burning AI credits.
echo.
echo  The 3 password-reset functions (send-otp, verify-otp, reset-password)
echo  ARE deployed with --no-verify-jwt: a signed-out user has no JWT, and
echo  those functions do not call requireUser(). They are rate-limited
echo  in-function instead.
echo.

cd /d "%~dp0"

echo Step 1: Deploying send-chat-message (JWT verified)...
.\supabase functions deploy send-chat-message
echo.

echo Step 2: Deploying moderate-message (JWT verified)...
.\supabase functions deploy moderate-message
echo.

echo Step 3: Deploying generate-podcast (JWT verified)...
.\supabase functions deploy generate-podcast
echo.

echo Step 4: Deploying create-meeting (JWT verified)...
.\supabase functions deploy create-meeting
echo.

echo Step 5: Deploying invite-to-meeting (JWT verified)...
.\supabase functions deploy invite-to-meeting
echo.

echo Step 6: Deploying generate-quiz (JWT verified)...
.\supabase functions deploy generate-quiz
echo.

echo Step 7: Deploying process-document (JWT verified)...
.\supabase functions deploy process-document
echo.

echo Step 8: Deploying send-otp (public / password reset)...
.\supabase functions deploy send-otp --no-verify-jwt
echo.

echo Step 9: Deploying verify-otp (public / password reset)...
.\supabase functions deploy verify-otp --no-verify-jwt
echo.

echo Step 10: Deploying reset-password (public / password reset)...
.\supabase functions deploy reset-password --no-verify-jwt
echo.

echo Step 11: Deploying send-reminder (JWT verified)...
.\supabase functions deploy send-reminder
echo.

echo ============================================
echo  ALL FUNCTIONS DEPLOYED!
echo ============================================
echo.
echo NEXT: Set your secrets in Supabase dashboard:
echo   Settings ^> Edge Functions ^> Secrets
echo   ANTHROPIC_KEY = your-anthropic-api-key
echo   SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
echo   RESEND_API_KEY = your-resend-key (OTP + meeting invites)
echo   FROM_EMAIL = your-verified-sender
echo   DAILY_API_KEY = OPTIONAL. Leave unset to use free meet.jit.si
echo     (first joiner becomes moderator). Only set it if you want
echo     Daily.co rooms AND have a card on file, or joining is blocked.
echo   ALLOWED_ORIGINS = comma-separated browser origins (optional)
echo.
echo IMPORTANT: Clients now send their user JWT to protected
echo functions. Run supabase\security_migration.sql for the
echo rate_limits table and consume_rate_limit() used by OTP flows.
echo.
pause