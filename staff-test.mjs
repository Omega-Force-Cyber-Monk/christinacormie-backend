import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'http://localhost:3000';

const results = [];

async function recordTest(name, requestInfo, responseInfo, assertionPassed, details = '') {
  results.push({
    name,
    request: requestInfo,
    response: responseInfo,
    passed: assertionPassed,
    details,
  });
  const statusStr = assertionPassed ? '✅ PASSED' : '❌ FAILED';
  console.log(`[${statusStr}] ${name} (Status: ${responseInfo.status})`);
  if (!assertionPassed) {
    console.error(`  Failure details: ${details}`);
    console.error(`  Response body:`, responseInfo.body);
  }
}

async function apiRequest(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const reqOptions = { method, headers };
  if (body) {
    reqOptions.body = JSON.stringify(body);
  }

  const res = await fetch(url, reqOptions);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }

  return {
    url,
    method,
    headers,
    requestBody: body,
    status: res.status,
    responseHeaders: Object.fromEntries(res.headers.entries()),
    responseBody: json,
  };
}

async function main() {
  console.log('--- STARTING VENDOR STAFF MANAGEMENT TESTS ---');

  // Clean up any test artifacts first
  const existingStaffUser = await prisma.user.findFirst({
    where: { email: 'maria@example.com' },
    include: { vendorStaff: true },
  });
  if (existingStaffUser) {
    await prisma.vendorStaff.deleteMany({ where: { userId: existingStaffUser.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: existingStaffUser.id } });
    await prisma.deviceToken.deleteMany({ where: { userId: existingStaffUser.id } });
    await prisma.userSetting.deleteMany({ where: { userId: existingStaffUser.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: existingStaffUser.id } });
    await prisma.userProfile.deleteMany({ where: { userId: existingStaffUser.id } });
    await prisma.user.delete({ where: { id: existingStaffUser.id } });
    console.log('Cleaned up existing maria@example.com test user');
  }

  // 1. Vendor Owner Login
  console.log('\n--- 1. Vendor Owner Login ---');
  const ownerLoginRes = await apiRequest('POST', '/api/v1/auth/login', {
    email: 'vendor@bitedrop.com',
    password: 'Password123!',
  });
  const ownerToken = ownerLoginRes.responseBody?.accessToken;
  const ownerVendorId = ownerLoginRes.responseBody?.user?.vendor?.id;
  await recordTest(
    'Vendor Owner Login',
    { method: 'POST', path: '/api/v1/auth/login', body: { email: 'vendor@bitedrop.com', password: '***' } },
    { status: ownerLoginRes.status, body: ownerLoginRes.responseBody },
    ownerLoginRes.status === 201 && !!ownerToken,
    ownerToken ? '' : 'Failed to obtain vendor owner access token'
  );

  // Setup helper vendors in DB
  console.log('\n--- Setting up helper vendors in DB ---');
  const pwHash = await bcrypt.hash('Password123!', 10);
  
  // Unapproved vendor (ACTIVE user so can login, but PENDING_APPROVAL vendor so cannot manage staff)
  let unapprovedVendorUser = await prisma.user.findFirst({ where: { email: 'unapproved_vendor@test.com' } });
  if (!unapprovedVendorUser) {
    unapprovedVendorUser = await prisma.user.create({
      data: {
        email: 'unapproved_vendor@test.com',
        passwordHash: pwHash,
        status: 'ACTIVE',
        userRoles: { create: [{ role: 'VENDOR' }] },
        vendor: {
          create: {
            businessName: 'Unapproved Test Truck',
            businessEmail: 'unapproved_vendor@test.com',
            status: 'PENDING_APPROVAL',
            isVerified: false,
          },
        },
      },
    });
  } else {
    await prisma.vendor.updateMany({
      where: { userId: unapprovedVendorUser.id },
      data: { status: 'PENDING_APPROVAL', isVerified: false },
    });
  }
  const unapprovedLoginRes = await apiRequest('POST', '/api/v1/auth/login', {
    email: 'unapproved_vendor@test.com',
    password: 'Password123!',
  });
  const unapprovedOwnerToken = unapprovedLoginRes.responseBody?.accessToken;

  // Second approved vendor for cross-vendor isolation tests
  let otherVendorUser = await prisma.user.findFirst({
    where: { email: 'other_vendor@test.com' },
    include: { vendor: true },
  });
  if (!otherVendorUser) {
    otherVendorUser = await prisma.user.create({
      data: {
        email: 'other_vendor@test.com',
        passwordHash: pwHash,
        status: 'ACTIVE',
        userRoles: { create: [{ role: 'VENDOR' }] },
        vendor: {
          create: {
            businessName: 'Other Vendor Business',
            businessEmail: 'other_vendor@test.com',
            status: 'APPROVED',
            isVerified: true,
          },
        },
      },
      include: { vendor: true },
    });
  }
  const otherVendorId = otherVendorUser.vendor.id;

  // 2. Add Staff - Validation & Error Tests
  console.log('\n--- 2. Add Staff - Validation & Error Tests ---');
  
  // 2.1 Invalid email
  const invEmailRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'invalid-email',
    pin: '1504',
  }, ownerToken);
  await recordTest(
    'Add Staff - Invalid email',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'invalid-email', pin: '1504' } },
    { status: invEmailRes.status, body: invEmailRes.responseBody },
    invEmailRes.status === 400,
    'Expected 400 Bad Request'
  );

  // 2.2 PIN less than 4 digits
  const shortPinRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'maria@example.com',
    pin: '123',
  }, ownerToken);
  await recordTest(
    'Add Staff - PIN less than 4 digits',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'maria@example.com', pin: '123' } },
    { status: shortPinRes.status, body: shortPinRes.responseBody },
    shortPinRes.status === 400,
    'Expected 400 Bad Request'
  );

  // 2.3 PIN more than 4 digits
  const longPinRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'maria@example.com',
    pin: '12345',
  }, ownerToken);
  await recordTest(
    'Add Staff - PIN more than 4 digits',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'maria@example.com', pin: '12345' } },
    { status: longPinRes.status, body: longPinRes.responseBody },
    longPinRes.status === 400,
    'Expected 400 Bad Request'
  );

  // 2.4 Non-numeric PIN
  const nonNumPinRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'maria@example.com',
    pin: 'abcd',
  }, ownerToken);
  await recordTest(
    'Add Staff - Non-numeric PIN',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'maria@example.com', pin: 'abcd' } },
    { status: nonNumPinRes.status, body: nonNumPinRes.responseBody },
    nonNumPinRes.status === 400,
    'Expected 400 Bad Request'
  );

  // 2.5 Unapproved vendor should fail
  const unapprovedStaffRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'maria@example.com',
    pin: '1504',
  }, unapprovedOwnerToken);
  await recordTest(
    'Add Staff - Unapproved vendor should fail',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'maria@example.com', pin: '1504' } },
    { status: unapprovedStaffRes.status, body: unapprovedStaffRes.responseBody },
    unapprovedStaffRes.status === 403,
    'Expected 403 Forbidden'
  );

  // 3. Add Staff - Success
  console.log('\n--- 3. Add Staff - Success ---');
  const addStaffRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'maria@example.com',
    pin: '1504',
  }, ownerToken);
  const staffData = addStaffRes.responseBody;
  const staffId = staffData?.id;
  const addStaffPassed =
    addStaffRes.status === 201 &&
    staffData?.email === 'maria@example.com' &&
    staffData?.pin === '1504' &&
    staffData?.status === 'ACTIVE' &&
    !!staffData?.addedAt &&
    !!staffData?.message;
  await recordTest(
    'Add Staff - Success (201)',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'maria@example.com', pin: '1504' } },
    { status: addStaffRes.status, body: addStaffRes.responseBody },
    addStaffPassed,
    'Expected 201 with staff id, email, pin, status, addedAt, message'
  );

  // 3.1 Verify Secure DB Storage (Not plain text)
  console.log('\n--- 3.1 Verify Secure PIN Storage in DB ---');
  const dbStaff = await prisma.vendorStaff.findFirst({
    where: { id: staffId },
  });
  const pinHashValid = dbStaff?.pinHash && (await bcrypt.compare('1504', dbStaff.pinHash));
  const pinEncryptedValid = dbStaff?.pinEncrypted && dbStaff.pinEncrypted.includes(':') && !dbStaff.pinEncrypted.includes('1504');
  const rawDbColumns = Object.keys(dbStaff || {});
  const hasPlainTextPinCol = rawDbColumns.includes('pin');
  const dbStoragePassed = pinHashValid && pinEncryptedValid && !hasPlainTextPinCol;
  await recordTest(
    'DB Check - PIN stored securely (hash + encrypted, no plain text)',
    { dbCheck: 'vendor_staff record' },
    { pinHashValid: !!pinHashValid, pinEncrypted: dbStaff?.pinEncrypted, hasPlainTextPinCol },
    dbStoragePassed,
    'PIN should be hashed with bcrypt and encrypted, not stored in plain text'
  );

  // 3.2 Duplicate staff for same vendor
  console.log('\n--- 3.2 Duplicate Staff for same vendor ---');
  const dupStaffRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'maria@example.com',
    pin: '1504',
  }, ownerToken);
  await recordTest(
    'Add Staff - Duplicate staff for same vendor',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'maria@example.com', pin: '1504' } },
    { status: dupStaffRes.status, body: dupStaffRes.responseBody },
    dupStaffRes.status === 409,
    'Expected 409 Conflict'
  );

  // 4. List Staff
  console.log('\n--- 4. List Staff ---');
  const listStaffRes = await apiRequest('GET', '/api/v1/vendors/me/staff', null, ownerToken);
  const listItems = listStaffRes.responseBody?.items || [];
  const foundMaria = listItems.find((s) => s.email === 'maria@example.com');
  const listStaffPassed =
    listStaffRes.status === 200 &&
    Array.isArray(listItems) &&
    foundMaria &&
    foundMaria.pin === '1504' &&
    foundMaria.status === 'ACTIVE' &&
    !!foundMaria.addedAt;
  await recordTest(
    'List Staff - Vendor owner access',
    { method: 'GET', path: '/api/v1/vendors/me/staff' },
    { status: listStaffRes.status, body: listStaffRes.responseBody },
    listStaffPassed,
    'Expected 200 with list of staff containing email, pin, status, addedAt'
  );

  // 5. Staff Login
  console.log('\n--- 5. Staff Login ---');
  // 5.1 Wrong PIN
  const wrongPinRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'maria@example.com',
    pin: '9999',
  });
  await recordTest(
    'Staff Login - Wrong PIN',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'maria@example.com', pin: '9999' } },
    { status: wrongPinRes.status, body: wrongPinRes.responseBody },
    wrongPinRes.status === 401,
    'Expected 401 Unauthorized'
  );

  // 5.2 Unknown email
  const unknownEmailRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'unknown_person@example.com',
    pin: '1504',
  });
  await recordTest(
    'Staff Login - Unknown email',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'unknown_person@example.com', pin: '1504' } },
    { status: unknownEmailRes.status, body: unknownEmailRes.responseBody },
    unknownEmailRes.status === 401,
    'Expected 401 Unauthorized'
  );

  // 5.3 Inactive staff
  await prisma.vendorStaff.update({
    where: { id: staffId },
    data: { status: 'DISABLED' },
  });
  const inactiveStaffRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'maria@example.com',
    pin: '1504',
  });
  await recordTest(
    'Staff Login - Inactive/Disabled staff',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'maria@example.com', pin: '1504' } },
    { status: inactiveStaffRes.status, body: inactiveStaffRes.responseBody },
    inactiveStaffRes.status === 401,
    'Expected 401 Unauthorized'
  );
  // Re-enable staff
  await prisma.vendorStaff.update({
    where: { id: staffId },
    data: { status: 'ACTIVE' },
  });

  // 5.4 Successful Staff Login
  const staffLoginRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'maria@example.com',
    pin: '1504',
  });
  let staffToken = staffLoginRes.responseBody?.accessToken;
  const staffUser = staffLoginRes.responseBody?.user;
  const staffLoginPassed =
    staffLoginRes.status === 201 &&
    !!staffToken &&
    !!staffLoginRes.responseBody?.refreshToken &&
    staffUser?.roles?.includes('VENDOR_STAFF') &&
    staffUser?.staff?.id === staffId &&
    staffUser?.staff?.vendorId === ownerVendorId;
  await recordTest(
    'Staff Login - Success (201)',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'maria@example.com', pin: '1504' } },
    { status: staffLoginRes.status, body: staffLoginRes.responseBody },
    staffLoginPassed,
    'Expected 201 with accessToken, refreshToken, roles includes VENDOR_STAFF, staff details'
  );

  // 5.5 Staff token cannot add staff
  const staffAddStaffRes = await apiRequest('POST', '/api/v1/vendors/me/staff', {
    email: 'other_staff@example.com',
    pin: '9999',
  }, staffToken);
  await recordTest(
    'Staff blocked from adding staff',
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'other_staff@example.com', pin: '9999' } },
    { status: staffAddStaffRes.status, body: staffAddStaffRes.responseBody },
    staffAddStaffRes.status === 403,
    'Expected 403 Forbidden'
  );

  // 5.6 Staff token cannot list staff
  const staffListStaffRes = await apiRequest('GET', '/api/v1/vendors/me/staff', null, staffToken);
  await recordTest(
    'Staff blocked from listing staff',
    { method: 'GET', path: '/api/v1/vendors/me/staff' },
    { status: staffListStaffRes.status, body: staffListStaffRes.responseBody },
    staffListStaffRes.status === 403,
    'Expected 403 Forbidden'
  );

  // 6. Reset PIN
  console.log('\n--- 6. Reset PIN ---');
  // 6.1 Invalid PIN (< 4 digits)
  const resetShortPinRes = await apiRequest('POST', `/api/v1/vendors/me/staff/${staffId}/reset-pin`, {
    pin: '12',
  }, ownerToken);
  await recordTest(
    'Reset PIN - Invalid PIN (< 4 digits)',
    { method: 'POST', path: `/api/v1/vendors/me/staff/${staffId}/reset-pin`, body: { pin: '12' } },
    { status: resetShortPinRes.status, body: resetShortPinRes.responseBody },
    resetShortPinRes.status === 400,
    'Expected 400 Bad Request'
  );

  // 6.2 Wrong staffId
  const resetWrongStaffRes = await apiRequest('POST', `/api/v1/vendors/me/staff/00000000-0000-0000-0000-000000000000/reset-pin`, {
    pin: '5678',
  }, ownerToken);
  await recordTest(
    'Reset PIN - Non-existent staffId',
    { method: 'POST', path: `/api/v1/vendors/me/staff/00000000-0000-0000-0000-000000000000/reset-pin`, body: { pin: '5678' } },
    { status: resetWrongStaffRes.status, body: resetWrongStaffRes.responseBody },
    resetWrongStaffRes.status === 404,
    'Expected 404 Not Found'
  );

  // 6.3 Staff from another vendor
  // Create staff for otherVendor
  let otherStaffUser = await prisma.user.findFirst({ where: { email: 'other_staff_member@test.com' } });
  if (!otherStaffUser) {
    otherStaffUser = await prisma.user.create({
      data: {
        email: 'other_staff_member@test.com',
        status: 'ACTIVE',
        userRoles: { create: [{ role: 'VENDOR_STAFF' }] },
      },
    });
  }
  let otherStaff = await prisma.vendorStaff.findFirst({ where: { userId: otherStaffUser.id } });
  if (!otherStaff) {
    otherStaff = await prisma.vendorStaff.create({
      data: {
        vendorId: otherVendorId,
        userId: otherStaffUser.id,
        email: 'other_staff_member@test.com',
        pinHash: await bcrypt.hash('9999', 10),
        pinEncrypted: 'mock-encrypted-other',
        status: 'ACTIVE',
      },
    });
  }
  const resetOtherVendorStaffRes = await apiRequest('POST', `/api/v1/vendors/me/staff/${otherStaff.id}/reset-pin`, {
    pin: '5678',
  }, ownerToken);
  await recordTest(
    'Reset PIN - Staff from another vendor',
    { method: 'POST', path: `/api/v1/vendors/me/staff/${otherStaff.id}/reset-pin`, body: { pin: '5678' } },
    { status: resetOtherVendorStaffRes.status, body: resetOtherVendorStaffRes.responseBody },
    resetOtherVendorStaffRes.status === 404,
    'Expected 404 Not Found'
  );

  // 6.4 Staff token forbidden to reset PIN
  const staffResetPinRes = await apiRequest('POST', `/api/v1/vendors/me/staff/${staffId}/reset-pin`, {
    pin: '5678',
  }, staffToken);
  await recordTest(
    'Reset PIN - Staff token forbidden',
    { method: 'POST', path: `/api/v1/vendors/me/staff/${staffId}/reset-pin`, body: { pin: '5678' } },
    { status: staffResetPinRes.status, body: staffResetPinRes.responseBody },
    staffResetPinRes.status === 403,
    'Expected 403 Forbidden'
  );

  // 6.5 Vendor owner resets PIN (Success)
  const resetSuccessRes = await apiRequest('POST', `/api/v1/vendors/me/staff/${staffId}/reset-pin`, {
    pin: '5678',
  }, ownerToken);
  const resetSuccessPassed =
    resetSuccessRes.status === 201 &&
    resetSuccessRes.responseBody?.pin === '5678';
  await recordTest(
    'Reset PIN - Success (201)',
    { method: 'POST', path: `/api/v1/vendors/me/staff/${staffId}/reset-pin`, body: { pin: '5678' } },
    { status: resetSuccessRes.status, body: resetSuccessRes.responseBody },
    resetSuccessPassed,
    'Expected 201 with updated pin 5678'
  );

  // 6.6 Old PIN login fails
  const oldPinLoginRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'maria@example.com',
    pin: '1504',
  });
  await recordTest(
    'Staff Login - Old PIN fails after reset',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'maria@example.com', pin: '1504' } },
    { status: oldPinLoginRes.status, body: oldPinLoginRes.responseBody },
    oldPinLoginRes.status === 401,
    'Expected 401 Unauthorized'
  );

  // 6.7 New PIN login succeeds
  const newPinLoginRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'maria@example.com',
    pin: '5678',
  });
  staffToken = newPinLoginRes.responseBody?.accessToken;
  await recordTest(
    'Staff Login - New PIN succeeds after reset',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'maria@example.com', pin: '5678' } },
    { status: newPinLoginRes.status, body: newPinLoginRes.responseBody },
    newPinLoginRes.status === 201 && !!staffToken,
    'Expected 201 with new access token'
  );

  // 7. Staff Allowed Access
  console.log('\n--- 7. Staff Allowed Access ---');
  // 7.1 GET /api/v1/vendors/me
  const staffVendorMeRes = await apiRequest('GET', '/api/v1/vendors/me', null, staffToken);
  await recordTest(
    'Staff Allowed - GET /api/v1/vendors/me',
    { method: 'GET', path: '/api/v1/vendors/me' },
    { status: staffVendorMeRes.status, body: staffVendorMeRes.responseBody },
    staffVendorMeRes.status === 200 && staffVendorMeRes.responseBody?.id === ownerVendorId,
    'Expected 200 with assigned vendor info'
  );

  // 7.2 GET /api/v1/vendors/me/qr-code
  const staffQrRes = await apiRequest('GET', '/api/v1/vendors/me/qr-code', null, staffToken);
  await recordTest(
    'Staff Allowed - GET /api/v1/vendors/me/qr-code',
    { method: 'GET', path: '/api/v1/vendors/me/qr-code' },
    { status: staffQrRes.status, body: staffQrRes.responseBody },
    staffQrRes.status === 200 && staffQrRes.responseBody?.vendorId === ownerVendorId,
    'Expected 200 with QR code info'
  );

  // 7.3 GET /api/v1/bookings/vendor/mine
  const staffBookingsMineRes = await apiRequest('GET', '/api/v1/bookings/vendor/mine', null, staffToken);
  await recordTest(
    'Staff Allowed - GET /api/v1/bookings/vendor/mine',
    { method: 'GET', path: '/api/v1/bookings/vendor/mine' },
    { status: staffBookingsMineRes.status, body: staffBookingsMineRes.responseBody },
    staffBookingsMineRes.status === 200 && Array.isArray(staffBookingsMineRes.responseBody),
    'Expected 200 with bookings list'
  );

  // 7.4 GET /api/v1/bookings/:bookingId (Assigned vs Other vendor)
  const existingBooking = await prisma.booking.findFirst({
    where: { vendorId: ownerVendorId },
  });
  const assignedBookingId = existingBooking?.id;

  const staffAssignedBookingRes = await apiRequest('GET', `/api/v1/bookings/${assignedBookingId}`, null, staffToken);
  await recordTest(
    'Staff Allowed - GET /api/v1/bookings/:bookingId (Assigned vendor)',
    { method: 'GET', path: `/api/v1/bookings/${assignedBookingId}` },
    { status: staffAssignedBookingRes.status, body: staffAssignedBookingRes.responseBody },
    staffAssignedBookingRes.status === 200 && staffAssignedBookingRes.responseBody?.id === assignedBookingId,
    'Expected 200 with booking details'
  );

  // Create or find booking for other vendor
  let otherTruck = await prisma.foodTruck.findFirst({ where: { vendorId: otherVendorId } });
  if (!otherTruck) {
    otherTruck = await prisma.foodTruck.create({
      data: {
        vendorId: otherVendorId,
        name: 'Other Truck',
        slug: `other-truck-${Date.now()}`,
        truckCallName: 'Other Truck',
        status: 'ACTIVE',
      },
    });
  }
  let otherVendorBooking = await prisma.booking.findFirst({ where: { vendorId: otherVendorId } });
  if (!otherVendorBooking) {
    otherVendorBooking = await prisma.booking.create({
      data: {
        bookingNumber: `BK-TEST-${Date.now()}`,
        bookingType: 'EVENT',
        vendorId: otherVendorId,
        foodTruckId: otherTruck.id,
        customerId: otherVendorUser.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600000),
        status: 'PENDING',
        totalAmount: 200,
        address: '456 Other St',
        guestCount: 30,
      },
    });
  }

  const staffOtherBookingRes = await apiRequest('GET', `/api/v1/bookings/${otherVendorBooking.id}`, null, staffToken);
  await recordTest(
    'Staff Blocked - GET /api/v1/bookings/:bookingId (Other vendor booking)',
    { method: 'GET', path: `/api/v1/bookings/${otherVendorBooking.id}` },
    { status: staffOtherBookingRes.status, body: staffOtherBookingRes.responseBody },
    staffOtherBookingRes.status === 403,
    'Expected 403 Forbidden for booking belonging to another vendor'
  );

  // 7.5 Redemptions: POST /api/v1/vendors/me/redemptions/confirm
  const customerUser = await prisma.user.findFirst({ where: { email: 'customer@bitedrop.com' } });
  const ownerTruck = await prisma.foodTruck.findFirst({ where: { vendorId: ownerVendorId } });
  
  const code1 = Math.floor(100000 + Math.random() * 900000).toString();
  // Pending redemption for assigned truck
  const assignedRedemption = await prisma.rewardRedemption.create({
    data: {
      userId: customerUser.id,
      rewardValue: 10,
      pointsSpent: 100,
      backupCode: code1,
      redemptionToken: `rdm_test_${Date.now()}_${code1}`,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 3600000),
      foodTruckId: ownerTruck.id,
    },
  });

  const staffConfirmAssignedRes = await apiRequest('POST', '/api/v1/vendors/me/redemptions/confirm', {
    manualCode: code1,
  }, staffToken);
  await recordTest(
    'Staff Allowed - Confirm valid redemption for assigned vendor',
    { method: 'POST', path: '/api/v1/vendors/me/redemptions/confirm', body: { manualCode: code1 } },
    { status: staffConfirmAssignedRes.status, body: staffConfirmAssignedRes.responseBody },
    staffConfirmAssignedRes.status === 201 && staffConfirmAssignedRes.responseBody?.success === true,
    'Expected 201 Completed redemption'
  );

  const code2 = Math.floor(100000 + Math.random() * 900000).toString();
  // Pending redemption for OTHER truck
  const otherRedemption = await prisma.rewardRedemption.create({
    data: {
      userId: customerUser.id,
      rewardValue: 15,
      pointsSpent: 150,
      backupCode: code2,
      redemptionToken: `rdm_other_${Date.now()}_${code2}`,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 3600000),
      foodTruckId: otherTruck.id,
    },
  });
  const staffConfirmOtherRes = await apiRequest('POST', '/api/v1/vendors/me/redemptions/confirm', {
    manualCode: code2,
  }, staffToken);
  await recordTest(
    'Staff Blocked - Confirm redemption for another vendor/truck',
    { method: 'POST', path: '/api/v1/vendors/me/redemptions/confirm', body: { manualCode: '998877' } },
    { status: staffConfirmOtherRes.status, body: staffConfirmOtherRes.responseBody },
    staffConfirmOtherRes.status === 400,
    'Expected 400 Bad Request (This redemption code was generated for another food truck)'
  );

  // 8. Staff Blocked Access
  console.log('\n--- 8. Staff Blocked Access (All must be 403 Forbidden) ---');
  const blockedEndpoints = [
    { method: 'PATCH', path: '/api/v1/vendors/me', body: { description: 'Hacked description' }, name: 'PATCH /api/v1/vendors/me' },
    { method: 'POST', path: '/api/v1/vendors/me/onboarding', body: { truckName: 'Test' }, name: 'POST /api/v1/vendors/me/onboarding' },
    { method: 'POST', path: '/api/v1/vendors/me/verification-requests', body: { documents: [] }, name: 'POST /api/v1/vendors/me/verification-requests' },
    { method: 'GET', path: '/api/v1/vendors/me/analytics', body: null, name: 'GET /api/v1/vendors/me/analytics' },
    { method: 'GET', path: '/api/v1/vendors/me/staff', body: null, name: 'GET /api/v1/vendors/me/staff' },
    { method: 'POST', path: '/api/v1/vendors/me/staff', body: { email: 'test@example.com', pin: '1111' }, name: 'POST /api/v1/vendors/me/staff' },
    { method: 'POST', path: `/api/v1/vendors/me/staff/${staffId}/reset-pin`, body: { pin: '1111' }, name: 'POST /api/v1/vendors/me/staff/:staffId/reset-pin' },
    { method: 'DELETE', path: `/api/v1/vendors/me/staff/${staffId}`, body: null, name: 'DELETE /api/v1/vendors/me/staff/:staffId' },
    { method: 'PATCH', path: `/api/v1/bookings/${assignedBookingId}/accept`, body: { reason: 'Staff accept' }, name: 'PATCH /api/v1/bookings/:bookingId/accept' },
    { method: 'PATCH', path: `/api/v1/bookings/${assignedBookingId}/reject`, body: { rejectionReason: 'Staff reject' }, name: 'PATCH /api/v1/bookings/:bookingId/reject' },
    { method: 'POST', path: `/api/v1/bookings/${assignedBookingId}/quotes`, body: { quoteAmount: 100 }, name: 'POST /api/v1/bookings/:bookingId/quotes' },
  ];

  for (const ep of blockedEndpoints) {
    const res = await apiRequest(ep.method, ep.path, ep.body, staffToken);
    await recordTest(
      `Staff Blocked - ${ep.name}`,
      { method: ep.method, path: ep.path, body: ep.body },
      { status: res.status, body: res.responseBody },
      res.status === 403,
      `Expected 403 Forbidden, got ${res.status}`
    );
  }

  // 9. Delete Staff
  console.log('\n--- 9. Delete Staff ---');
  const deleteStaffRes = await apiRequest('DELETE', `/api/v1/vendors/me/staff/${staffId}`, null, ownerToken);
  const deletePassed =
    deleteStaffRes.status === 200 &&
    deleteStaffRes.responseBody?.deleted === true &&
    deleteStaffRes.responseBody?.message === 'Staff member deleted successfully';
  await recordTest(
    'Delete Staff - Success (200)',
    { method: 'DELETE', path: `/api/v1/vendors/me/staff/${staffId}` },
    { status: deleteStaffRes.status, body: deleteStaffRes.responseBody },
    deletePassed,
    'Expected 200 with deleted: true and success message'
  );

  // 9.1 Deleted staff can no longer login
  const deletedLoginRes = await apiRequest('POST', '/api/v1/auth/staff/login', {
    email: 'maria@example.com',
    pin: '5678',
  });
  await recordTest(
    'Staff Login - Deleted staff cannot login',
    { method: 'POST', path: '/api/v1/auth/staff/login', body: { email: 'maria@example.com', pin: '5678' } },
    { status: deletedLoginRes.status, body: deletedLoginRes.responseBody },
    deletedLoginRes.status === 401,
    'Expected 401 Unauthorized'
  );

  // 9.2 Deleted staff no longer appears in staff list
  const afterDeleteListRes = await apiRequest('GET', '/api/v1/vendors/me/staff', null, ownerToken);
  const remainingStaff = afterDeleteListRes.responseBody?.items || [];
  const foundDeleted = remainingStaff.find((s) => s.id === staffId || s.email === 'maria@example.com');
  await recordTest(
    'List Staff - Deleted staff no longer appears in list',
    { method: 'GET', path: '/api/v1/vendors/me/staff' },
    { status: afterDeleteListRes.status, body: afterDeleteListRes.responseBody },
    afterDeleteListRes.status === 200 && !foundDeleted,
    'Deleted staff should not be in staff list'
  );

  // Summary
  console.log('\n========================================');
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('========================================\n');

  return { totalTests, passedTests, failedTests, results };
}

main()
  .catch((err) => {
    console.error('Test suite error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
