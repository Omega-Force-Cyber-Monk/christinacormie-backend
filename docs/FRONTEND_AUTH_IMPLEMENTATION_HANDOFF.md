# BiteDrop Frontend Authentication Implementation Handoff

Project: BiteDrop

Backend base path: `/api/v1/auth`

Swagger docs: `/api/v1/docs`

Goal: Implement frontend authentication screens and API integration for customer signup, vendor signup, email OTP verification, login, staff PIN login, Google auth, forgot password, reset password, refresh token, logout, and change password.

## Important Backend Behavior

- Signup does not immediately return tokens. It creates a `PENDING` account and sends a 6-digit email verification code.
- Email verification activates the account and returns `accessToken`, `refreshToken`, and `user`.
- Verification codes expire in 10 minutes.
- Password reset codes expire in 10 minutes.
- Login is blocked until email verification is complete.
- Access tokens default to 15 minutes.
- Refresh tokens default to 30 days.
- Refresh token rotation is enabled. Every successful refresh revokes the old refresh token and returns a new pair.
- Password reset revokes all existing refresh tokens for that user.
- API validation strips unknown fields and rejects non-whitelisted request properties.

## Shared Response Shapes

Successful auth response:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "user-id",
    "email": "customer@example.com",
    "displayName": "John Doe",
    "roles": ["CUSTOMER"]
  }
}
```

Vendor auth response adds vendor metadata:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "user-id",
    "email": "vendor@example.com",
    "displayName": "Taco Owner",
    "roles": ["VENDOR"],
    "vendor": {
      "id": "vendor-id",
      "businessName": "Taco Paradise"
    }
  }
}
```

Staff auth response adds staff metadata:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "staff-user-id",
    "email": "maria@example.com",
    "displayName": "maria",
    "roles": ["VENDOR_STAFF"],
    "staff": {
      "id": "staff-id",
      "vendorId": "vendor-id",
      "businessName": "Taco Paradise"
    }
  }
}
```

Standard API error shape:

```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "error": "Bad Request"
}
```

Validation errors may return `message` as an array of strings:

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

Frontend should normalize both string and string-array messages into displayable form messages.

## Token Storage And API Client

Recommended frontend behavior:

- Store `accessToken`, `refreshToken`, and `user` after login, email verification, Google auth, staff login, or token refresh.
- Send authenticated requests with `Authorization: Bearer <accessToken>`.
- On `401` from an authenticated API call, attempt one refresh request.
- If refresh succeeds, retry the original request once with the new access token.
- If refresh fails, clear auth state and route to login.
- On logout, call backend logout with the current refresh token, then clear local auth state.

Token storage choice:

- Mobile: secure storage/keychain/keystore.
- Web: prefer secure httpOnly cookies if a frontend gateway is added later. With the current bearer-token API, store tokens in the safest available client storage for the app architecture and avoid exposing tokens to third-party scripts.

## Auth State Model

Suggested client-side state:

```ts
type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Array<'CUSTOMER' | 'VENDOR' | 'VENDOR_STAFF' | 'ADMIN'>;
  vendor?: {
    id: string;
    businessName: string;
  };
  staff?: {
    id: string;
    vendorId: string;
    businessName?: string;
  };
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
};
```

Use `user.roles` for navigation:

- `CUSTOMER`: customer app/home
- `VENDOR`: vendor dashboard/onboarding
- `VENDOR_STAFF`: vendor staff dashboard/POS/check-in tools
- `ADMIN`: admin dashboard

## Endpoint Summary

| Feature | Method | Endpoint | Auth Required |
| --- | --- | --- | --- |
| Customer signup | `POST` | `/api/v1/auth/register/customer` | No |
| Vendor signup | `POST` | `/api/v1/auth/register/vendor` | No |
| Verify signup code | `POST` | `/api/v1/auth/verify-email` | No |
| Resend signup code | `POST` | `/api/v1/auth/resend-verification-code` | No |
| Login | `POST` | `/api/v1/auth/login` | No |
| Staff login | `POST` | `/api/v1/auth/staff/login` | No |
| Forgot password | `POST` | `/api/v1/auth/forgot-password` | No |
| Verify password reset code | `POST` | `/api/v1/auth/verify-reset-code` | No |
| Reset password | `POST` | `/api/v1/auth/reset-password` | No |
| Google login/signup | `POST` | `/api/v1/auth/google` | No |
| Refresh token | `POST` | `/api/v1/auth/refresh` | No |
| Logout | `POST` | `/api/v1/auth/logout` | Yes |
| Change password | `POST` | `/api/v1/auth/change-password` | Yes |

## Customer Signup

Endpoint:

```text
POST /api/v1/auth/register/customer
```

Request:

```json
{
  "name": "John Doe",
  "email": "customer@example.com",
  "password": "Password123!",
  "dateOfBirth": "1998-05-20"
}
```

Field rules:

- `name`: required, string, 2-150 chars
- `email`: required, valid email
- `password`: required, string, 8-128 chars
- `dateOfBirth`: required, valid date string

Success response:

```json
{
  "success": true,
  "status": "PENDING",
  "message": "Registration successful. Verify the 6-digit code sent to your email.",
  "email": "customer@example.com"
}
```

Frontend flow:

1. Submit signup form.
2. On success, route to email verification screen.
3. Pass or persist the submitted email for verification.
4. Do not mark the user as authenticated yet.

Common errors:

- `409`: email already registered
- `400`: invalid fields
- `500`: account saved but verification email failed; show resend option

## Vendor Signup

Endpoint:

```text
POST /api/v1/auth/register/vendor
```

Minimal request:

```json
{
  "email": "vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!"
}
```

Full request:

```json
{
  "email": "vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!",
  "dateOfBirth": "1994-08-12",
  "businessName": "Tasty Tacos Food Truck",
  "businessEmail": "contact@tastytacos.com",
  "businessPhone": "+12025550199",
  "description": "Best gourmet tacos in town",
  "websiteUrl": "https://tastytacos.example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "displayName": "JaneSmith",
  "timezone": "America/New_York"
}
```

Field rules:

- `email`: required, valid email
- `phone`: required, valid phone number
- `password`: required, string, 8-128 chars
- `dateOfBirth`: optional date string
- `businessName`: optional, max 255 chars
- `businessEmail`: optional valid email
- `businessPhone`: optional valid phone number
- `description`: optional string
- `websiteUrl`: optional valid URL
- `firstName`: optional, max 100 chars
- `lastName`: optional, max 100 chars
- `displayName`: optional, max 150 chars
- `timezone`: optional, max 100 chars

Success response:

```json
{
  "success": true,
  "status": "PENDING",
  "message": "Registration successful. Verify the 6-digit code sent to your email.",
  "email": "vendor@example.com"
}
```

Frontend flow:

1. Submit vendor signup form.
2. On success, route to email verification screen.
3. Use the account email, not the business email, for verification.
4. After verification, route vendor users to vendor onboarding or dashboard depending on existing app flow.

Common errors:

- `409`: email or phone already registered
- `400`: invalid fields
- `500`: account saved but verification email failed; show resend option

## Email Verification OTP

Endpoint:

```text
POST /api/v1/auth/verify-email
```

Request:

```json
{
  "email": "customer@example.com",
  "code": "482913"
}
```

Field rules:

- `email`: required, valid email
- `code`: required, exactly 6 characters

Success response: auth response with `accessToken`, `refreshToken`, and `user`.

Frontend flow:

1. Show a 6-digit code input.
2. Submit email and code.
3. On success, save tokens and user.
4. Route by role.

Recommended UI behavior:

- Show "code expires in 10 minutes" copy.
- Allow paste into OTP input.
- Keep the email visible or editable.
- Provide a "Resend code" action.
- Disable repeated submit while request is in flight.

Common errors:

- `400`: wrong code, expired code, already verified, no active code
- `404`: no account for email

## Resend Email Verification Code

Endpoint:

```text
POST /api/v1/auth/resend-verification-code
```

Request:

```json
{
  "email": "customer@example.com"
}
```

Success response:

```json
{
  "success": true,
  "status": "PENDING",
  "message": "Registration successful. Verify the 6-digit code sent to your email.",
  "email": "customer@example.com"
}
```

Frontend behavior:

- Keep the user on the OTP screen.
- Reset the 10-minute timer after a successful resend.
- Consider adding a short client-side cooldown to prevent accidental repeated taps.

Common errors:

- `400`: email already verified
- `404`: no account for email
- `500`: verification email could not be sent

## Login

Endpoint:

```text
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "customer@example.com",
  "password": "Password123!"
}
```

Field rules:

- `email`: required, valid email
- `password`: required, min 8 chars

Success response: auth response with `accessToken`, `refreshToken`, and `user`.

Frontend flow:

1. Submit login form.
2. Save tokens and user on success.
3. Route by role.

Common errors:

- `400`: email verification required. Route to OTP screen and prefill email.
- `401`: invalid email or password
- `403`: account suspended, deactivated, or blocked

## Staff Login

Endpoint:

```text
POST /api/v1/auth/staff/login
```

Request:

```json
{
  "email": "maria@example.com",
  "pin": "1504"
}
```

Field rules:

- `email`: required, valid email
- `pin`: required, exactly 4 digits

Success response: auth response with `roles: ["VENDOR_STAFF"]` and `staff` metadata.

Frontend flow:

1. Provide a staff login mode/screen separate from normal password login.
2. Submit email and 4-digit PIN.
3. Save tokens and user on success.
4. Route to staff-specific dashboard or tools.

Common errors:

- `401`: invalid email/PIN or inactive staff account
- `400`: email verification required if the linked user is pending
- `403`: account suspended, deactivated, or blocked

## Forgot Password

Endpoint:

```text
POST /api/v1/auth/forgot-password
```

Request:

```json
{
  "email": "customer@example.com"
}
```

Success response:

```json
{
  "success": true,
  "message": "Password reset code sent to your email.",
  "email": "customer@example.com"
}
```

Frontend flow:

1. User enters email.
2. On success, route to reset-code verification screen.
3. Keep email in route state or local auth flow state.

Common errors:

- `400`: Google-only account or pending email verification
- `403`: account suspended, deactivated, or blocked
- `404`: no account found
- `500`: reset code email could not be sent

## Verify Password Reset Code

Endpoint:

```text
POST /api/v1/auth/verify-reset-code
```

Request:

```json
{
  "email": "customer@example.com",
  "code": "482913"
}
```

Success response:

```json
{
  "success": true,
  "message": "Password reset code verified. You can now set a new password.",
  "email": "customer@example.com"
}
```

Frontend flow:

1. User enters the 6-digit code.
2. On success, route to "Set new password".
3. Keep both email and code for the final reset request.

Common errors:

- `400`: no active reset code, expired code, wrong code, or already used code
- `404`: no account found

## Reset Password

Endpoint:

```text
POST /api/v1/auth/reset-password
```

Request:

```json
{
  "email": "customer@example.com",
  "code": "482913",
  "newPassword": "NewPassword123!",
  "confirmNewPassword": "NewPassword123!"
}
```

Field rules:

- `email`: required, valid email
- `code`: required, exactly 6 characters
- `newPassword`: required, min 8 chars, must include uppercase, lowercase, and a number or special character
- `confirmNewPassword`: required, must match `newPassword`

Success response:

```json
{
  "success": true,
  "message": "Password reset successfully. Please login with your new password."
}
```

Frontend flow:

1. Submit email, code, new password, and confirmation.
2. On success, clear any existing auth state.
3. Route to login with a success message.

Important:

- Existing refresh tokens are revoked after password reset.
- Do not automatically log the user in after reset; backend returns success only.

Common errors:

- `400`: weak password, passwords do not match, same as old password, invalid code
- `404`: no account found

## Google Login Or Signup

Endpoint:

```text
POST /api/v1/auth/google
```

Customer request:

```json
{
  "idToken": "google-id-token",
  "role": "CUSTOMER",
  "dateOfBirth": "1998-05-20"
}
```

Vendor request:

```json
{
  "idToken": "google-id-token",
  "role": "VENDOR",
  "businessName": "Tasty Tacos Food Truck",
  "dateOfBirth": "1994-08-12"
}
```

Field rules:

- `idToken`: required, Google ID token from client sign-in flow
- `role`: optional; defaults to `CUSTOMER`
- `businessName`: required only when creating a new vendor account
- `dateOfBirth`: optional date string

Success response: auth response with `accessToken`, `refreshToken`, and `user`.

Frontend flow:

1. Complete Google sign-in on the client.
2. Send Google `idToken` to backend.
3. Save returned tokens and user.
4. Route by role.

Common errors:

- `400`: vendor Google signup is missing `businessName`
- `401`: invalid or expired Google token
- `403`: admin signup attempted or account blocked

Notes:

- Google-created accounts are immediately active and email-verified.
- Google-only accounts cannot use email-code password reset unless they later get a password feature.

## Refresh Token

Endpoint:

```text
POST /api/v1/auth/refresh
```

Request:

```json
{
  "refreshToken": "current-refresh-token"
}
```

Success response: new auth response with a new access token and new refresh token.

Frontend behavior:

- Replace both tokens after every successful refresh.
- Never continue using the old refresh token after refresh succeeds.
- Protect against multiple simultaneous refresh requests. Queue pending API retries behind one active refresh call.

Common errors:

- `401`: refresh token invalid, expired, revoked, or mismatched

## Logout

Endpoint:

```text
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```

Request:

```json
{
  "refreshToken": "current-refresh-token"
}
```

Success response:

```json
{
  "success": true
}
```

Frontend behavior:

- Call logout when the user intentionally logs out.
- Clear local tokens and user even if the network request fails.
- If logout returns `401` because the access token expired, clear local state anyway.

Common errors:

- `401`: access token missing, invalid, or expired
- `403`: refresh token belongs to a different user

## Change Password

Endpoint:

```text
POST /api/v1/auth/change-password
Authorization: Bearer <accessToken>
```

Request:

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmNewPassword": "NewPassword123!"
}
```

Field rules:

- `currentPassword`: required
- `newPassword`: required, min 8 chars, must include uppercase, lowercase, and a number or special character
- `confirmNewPassword`: optional at DTO level, but frontend should require it and make it match

Success response:

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

Frontend behavior:

- Require current password, new password, and confirmation.
- Show password strength requirements before submit.
- After success, keep the user logged in unless product wants forced re-login.

Common errors:

- `400`: new passwords do not match, account has no password, same as current password
- `401`: access token invalid or current password is incorrect
- `404`: user not found

## Suggested Frontend Screens

Required screens:

- Login
- Customer signup
- Vendor signup
- Email verification OTP
- Forgot password email entry
- Password reset OTP verification
- Set new password
- Staff login
- Change password

Optional screens/modals:

- Auth landing screen with customer/vendor/staff entry points
- Google vendor signup business-name collection screen
- Account blocked/suspended support screen

## Recommended Route Flow

Customer signup:

```text
/signup/customer
  -> POST register/customer
  -> /verify-email?email=customer@example.com
  -> POST verify-email
  -> save auth
  -> customer home
```

Vendor signup:

```text
/signup/vendor
  -> POST register/vendor
  -> /verify-email?email=vendor@example.com
  -> POST verify-email
  -> save auth
  -> vendor onboarding/dashboard
```

Login with pending email:

```text
/login
  -> POST login
  -> 400 email verification required
  -> /verify-email?email=submitted-email
```

Forgot password:

```text
/forgot-password
  -> POST forgot-password
  -> /forgot-password/verify-code
  -> POST verify-reset-code
  -> /forgot-password/reset
  -> POST reset-password
  -> /login
```

## Frontend Validation Checklist

Use client-side validation to reduce avoidable API errors:

- Email fields must be valid emails.
- Customer name must be 2-150 chars.
- Customer date of birth is required.
- Vendor phone and business phone must be valid phone strings accepted by the app locale.
- Password must be 8-128 chars for signup.
- New password must include uppercase, lowercase, and a number or special character.
- OTP verification code must be exactly 6 characters.
- Staff PIN must be exactly 4 digits.
- Website URL must be a full valid URL when provided.

## Error Handling Checklist

Frontend should map these messages to clear UI states:

- `Email verification is required before login...`: send user to email OTP screen.
- `Incorrect verification code...`: keep user on OTP screen and clear code input.
- `Verification code has expired...`: show resend action.
- `Email is already verified. Please login.`: route to login.
- `Invalid email or password`: show generic login error.
- `Invalid email or PIN`: show generic staff login error.
- `This account uses Google sign-in...`: show "Continue with Google" CTA.
- `This account is suspended/deactivated/blocked...`: show support/contact state.
- `New password and confirm password do not match`: show field-level confirmation error.

## Implementation Notes

- All auth endpoints use JSON bodies.
- For protected endpoints, include `Authorization: Bearer <accessToken>`.
- The backend returns `201` for successful `POST` operations, including login and verification.
- Keep the auth API methods centralized in one client/service module.
- Keep OTP state isolated from global authenticated state until verification succeeds.
- After password reset, wipe any stale local tokens because backend revokes refresh tokens.
- When role-specific fields are absent, do not assume vendor/staff identity from route alone; use `user.roles`.

## Minimal Auth API Client Shape

```ts
const authApi = {
  registerCustomer: (body: RegisterCustomerBody) =>
    post('/api/v1/auth/register/customer', body),
  registerVendor: (body: RegisterVendorBody) =>
    post('/api/v1/auth/register/vendor', body),
  verifyEmail: (body: { email: string; code: string }) =>
    post('/api/v1/auth/verify-email', body),
  resendVerificationCode: (body: { email: string }) =>
    post('/api/v1/auth/resend-verification-code', body),
  login: (body: { email: string; password: string }) =>
    post('/api/v1/auth/login', body),
  staffLogin: (body: { email: string; pin: string }) =>
    post('/api/v1/auth/staff/login', body),
  forgotPassword: (body: { email: string }) =>
    post('/api/v1/auth/forgot-password', body),
  verifyResetCode: (body: { email: string; code: string }) =>
    post('/api/v1/auth/verify-reset-code', body),
  resetPassword: (body: ResetPasswordBody) =>
    post('/api/v1/auth/reset-password', body),
  googleAuth: (body: GoogleAuthBody) =>
    post('/api/v1/auth/google', body),
  refresh: (body: { refreshToken: string }) =>
    post('/api/v1/auth/refresh', body),
  logout: (body: { refreshToken: string }, accessToken: string) =>
    post('/api/v1/auth/logout', body, accessToken),
  changePassword: (body: ChangePasswordBody, accessToken: string) =>
    post('/api/v1/auth/change-password', body, accessToken),
};
```

## QA Checklist

- Customer can sign up, verify email, and becomes authenticated.
- Vendor can sign up with minimal fields, verify email, and receives vendor metadata.
- Vendor can sign up with full business profile fields.
- Login works for verified users.
- Login for pending users routes to OTP verification.
- Resend verification sends a fresh code and the new code works.
- Wrong OTP displays an error and does not authenticate.
- Expired OTP displays a resend path.
- Forgot password sends a reset code.
- Reset-code verification routes to set-new-password screen.
- Reset password succeeds and requires login with the new password.
- Old refresh token no longer works after password reset.
- Refresh endpoint rotates refresh token and API retry uses the new access token.
- Logout clears local auth state.
- Staff login works with email and 4-digit PIN.
- Google customer login/signup works.
- Google vendor signup requires business name for new vendor accounts.
- Suspended, deactivated, and blocked accounts show a support-facing message.
