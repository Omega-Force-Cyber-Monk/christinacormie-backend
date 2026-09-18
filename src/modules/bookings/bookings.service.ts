import { calculateQuote } from './quote-financials';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcceptBookingQuoteDto } from './dto/accept-booking-quote.dto';
import {
  BookingIssueDto,
  BookingIssueMessageDto,
} from './dto/booking-issue.dto';
import { CreateBookingQuoteDto } from './dto/create-booking-quote.dto';
import { BookingTypeDto, CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingIssueResolutionDecisionDto,
  ResolveBookingIssueDto,
} from './dto/resolve-booking-issue.dto';
import { VendorBookingDecisionDto } from './dto/vendor-booking-decision.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { NotificationEventType } from '../notifications/enums/notification-event-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { RewardsService } from '../rewards/rewards.service';
import { bookingEventWindow } from './booking-event-window';
import { BookingsRepository } from './bookings.repository';

@Injectable()
export class BookingsService {
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
    private readonly rewardsService: RewardsService,
  ) {}

  async createBookingRequest(userId: string, dto: CreateBookingDto) {
    this.validateBookingConfirmations(dto);
    const customMenuItems = this.normalizeCustomMenuItems(dto.customMenuItems);
    const { startsAt, endsAt } = bookingEventWindow(dto);
    const normalizedDto: CreateBookingDto = {
      ...dto,
      bookingType: dto.bookingType ?? BookingTypeDto.EVENT,
      customMenuItems,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };

    this.validateBookingWindow(startsAt, endsAt);

    const foodTruck = await this.ensureFoodTruckExists(dto.foodTruckId);

    if (foodTruck.status !== 'ACTIVE') {
      throw new BadRequestException('Food truck is not active');
    }

    if (
      foodTruck.maximumGuestCapacity !== null &&
      dto.guestCount > foodTruck.maximumGuestCapacity
    ) {
      throw new BadRequestException('Guest count exceeds truck capacity');
    }

    await this.validatePreferredMenuItems(
      dto.foodTruckId,
      dto.preferredMenuItemIds,
    );

    const serviceArea = await this.validateServiceArea(
      dto.foodTruckId,
      normalizedDto,
    );
    await this.ensureNoOverlap(dto.foodTruckId, startsAt, endsAt);

    const booking = await this.bookingsRepository.createBooking(
      userId,
      foodTruck.vendorId,
      normalizedDto,
      serviceArea,
    );

    await this.notificationsService.notifyBookingCreated(userId, booking);

    return {
      message:
        "Booking request sent! Your booking request has been sent to the vendor. You'll receive a quote within 24 hours.",
      booking,
    };
  }

  listMyBookings(userId: string) {
    return this.bookingsRepository.listCustomerBookings(userId);
  }

  async listVendorBookings(userId: string) {
    const vendor = await this.ensureVendor(userId);
    return this.bookingsRepository.listVendorBookingsByVendorId(vendor.id);
  }

  async getBookingDetails(userId: string, bookingId: string) {
    const booking = await this.bookingsRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId === userId) {
      return booking;
    }

    const vendor = await this.ensureVendor(userId);

    if (booking.vendorId !== vendor.id) {
      throw new ForbiddenException('Booking is not visible to this user');
    }

    return booking;
  }

  async getBookingTracking(user: AuthenticatedUser, bookingId: string) {
    const { booking, roleView } = await this.ensureBookingVisible(
      user,
      bookingId,
    );

    return this.presentTracking(booking, roleView);
  }

  async requestCompletion(userId: string, bookingId: string) {
    const booking = await this.ensureVendorBooking(userId, bookingId);

    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
      throw new BadRequestException(
        'Completion can be requested only after the booking is confirmed',
      );
    }

    if (booking.completionRequestedAt) {
      throw new BadRequestException('Completion request already sent');
    }

    if (booking.completedAt || booking.status === 'COMPLETED') {
      throw new BadRequestException('Booking is already completed');
    }

    if (booking.startsAt > new Date()) {
      throw new BadRequestException(
        'Completion can be requested on or after the event day',
      );
    }

    const updated = await this.bookingsRepository.requestCompletion(
      bookingId,
      userId,
    );

    await this.notificationsService.createNotification({
      userId: booking.customerId,
      actorUserId: userId,
      type: 'BOOKING',
      title: 'Completion requested',
      message: `Booking ${booking.bookingNumber} is ready for your approval.`,
      bookingId,
      foodTruckId: booking.foodTruckId,
      actionUrl: `/api/v1/bookings/${bookingId}/tracking`,
    });

    return {
      message: 'Completion request sent successfully',
      booking: updated,
    };
  }

  async approveCompletion(userId: string, bookingId: string) {
    const booking =
      await this.bookingsRepository.findBookingForTracking(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException('Booking does not belong to this customer');
    }

    if (!booking.completionRequestedAt) {
      throw new BadRequestException('Completion request has not been sent yet');
    }

    if (booking.status === 'COMPLETED' || booking.completedAt) {
      throw new BadRequestException('Booking is already completed');
    }

    if (booking.issues.length) {
      throw new ConflictException(
        'This booking has an open issue and cannot be completed yet',
      );
    }

    const payout = await this.paymentsService.releaseBookingPayout(bookingId);
    const paymentReleasedAt = payout.paidAt ?? new Date();
    const updated = await this.bookingsRepository.approveCompletion(
      bookingId,
      userId,
      paymentReleasedAt,
    );

    await this.notificationsService.notifyVendorBookingUpdate(
      userId,
      updated,
      'Booking completed',
    );

    return {
      message: 'Booking completed and payment released successfully',
      booking: updated,
    };
  }

  async reportIssue(userId: string, bookingId: string, dto: BookingIssueDto) {
    const booking =
      await this.bookingsRepository.findBookingForTracking(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException('Booking does not belong to this customer');
    }

    if (!booking.completionRequestedAt) {
      throw new BadRequestException('Completion request has not been sent yet');
    }

    if (booking.status === 'COMPLETED' || booking.completedAt) {
      throw new BadRequestException('Completed bookings cannot be disputed');
    }

    const issue = await this.bookingsRepository.createIssue(
      bookingId,
      userId,
      dto.message,
    );

    await this.notificationsService.createNotification({
      userId: booking.vendor.userId,
      actorUserId: userId,
      type: 'BOOKING',
      title: 'Booking issue reported',
      message: `An issue was reported for booking ${booking.bookingNumber}.`,
      bookingId,
      foodTruckId: booking.foodTruckId,
      actionUrl: `/api/v1/bookings/${bookingId}/issues/${issue.id}/messages`,
    });

    await this.notificationsService.notifyAdmins({
      actorUserId: userId,
      title: 'Booking issue reported',
      message: `Customer reported an issue for booking ${booking.bookingNumber}.`,
      bookingId,
      foodTruckId: booking.foodTruckId,
      actionUrl: `/api/v1/admin/bookings/${bookingId}`,
      priority: 'HIGH',
      metadata: {
        eventType: NotificationEventType.BOOKING_ISSUE_REPORTED,
        bookingId,
        issueId: issue.id,
      },
      pushData: {
        eventType: NotificationEventType.BOOKING_ISSUE_REPORTED,
        bookingId,
        issueId: issue.id,
      },
    });

    return {
      message: 'Issue submitted successfully',
      issue: this.presentIssue(issue),
    };
  }

  async listIssueMessages(
    user: AuthenticatedUser,
    bookingId: string,
    issueId: string,
  ) {
    const { issue } = await this.ensureIssueVisible(user, bookingId, issueId);

    return {
      issue: this.presentIssue(issue),
      messages: issue.messages.map((message) =>
        this.presentIssueMessage(message),
      ),
    };
  }

  async sendIssueMessage(
    user: AuthenticatedUser,
    bookingId: string,
    issueId: string,
    dto: BookingIssueMessageDto,
  ) {
    const { senderRole } = await this.ensureIssueVisible(
      user,
      bookingId,
      issueId,
    );
    const issue = await this.bookingsRepository.findIssueForBooking(
      bookingId,
      issueId,
    );

    if (!issue || issue.status !== 'OPEN') {
      throw new BadRequestException('Booking issue is already resolved');
    }

    const message = await this.bookingsRepository.addIssueMessage(
      issueId,
      user.sub,
      senderRole,
      dto.message,
    );

    if (senderRole !== 'ADMIN') {
      await this.notificationsService.notifyAdmins({
        actorUserId: user.sub,
        title: 'New booking issue message',
        message: `New ${senderRole.toLowerCase()} message on booking ${issue.booking.bookingNumber}.`,
        bookingId,
        foodTruckId: issue.booking.foodTruckId,
        actionUrl: `/api/v1/admin/bookings/${bookingId}`,
        priority: 'MEDIUM',
        metadata: {
          eventType: NotificationEventType.BOOKING_ISSUE_MESSAGE_CREATED,
          bookingId,
          issueId,
          messageId: message.id,
          senderRole,
        },
        pushData: {
          eventType: NotificationEventType.BOOKING_ISSUE_MESSAGE_CREATED,
          bookingId,
          issueId,
          messageId: message.id,
        },
      });
    }

    return {
      message: 'Message sent successfully',
      item: this.presentIssueMessage(message),
    };
  }

  async resolveIssue(
    adminUserId: string,
    bookingId: string,
    issueId: string,
    dto: ResolveBookingIssueDto,
  ) {
    const issue = await this.bookingsRepository.findIssueForBooking(
      bookingId,
      issueId,
    );

    if (!issue) {
      throw new NotFoundException('Booking issue not found');
    }

    if (issue.status !== 'OPEN') {
      throw new BadRequestException('Booking issue is already resolved');
    }

    if (issue.booking.status === 'COMPLETED') {
      throw new BadRequestException(
        'Completed bookings cannot be resolved through issue decisions',
      );
    }

    if (dto.decision === BookingIssueResolutionDecisionDto.RELEASE_PAYOUT) {
      const payout = await this.paymentsService.releaseBookingPayout(bookingId);
      const paymentReleasedAt = payout.paidAt ?? new Date();
      const resolved = await this.bookingsRepository.resolveIssue(
        issueId,
        adminUserId,
        dto.decision,
        dto.resolutionNote,
      );
      const booking =
        await this.bookingsRepository.completeBookingAfterIssueResolution(
          bookingId,
          adminUserId,
          paymentReleasedAt,
        );

      await this.notificationsService.createNotification({
        userId: issue.booking.customerId,
        actorUserId: adminUserId,
        type: 'BOOKING',
        title: 'Booking issue resolved',
        message:
          'Your booking issue was reviewed. The booking has been completed and payment released.',
        bookingId,
        actionUrl: `/api/v1/bookings/${bookingId}/tracking`,
      });

      await this.notificationsService.notifyVendorBookingUpdate(
        adminUserId,
        booking,
        'Booking issue resolved',
      );

      return {
        message: 'Issue resolved, booking completed, and payout released',
        decision: dto.decision,
        issue: this.presentIssue(resolved),
        booking,
        payment: { payout },
      };
    }

    const refundResult =
      await this.paymentsService.refundBookingPaymentForIssue(
        bookingId,
        dto.resolutionNote,
      );
    const resolved = await this.bookingsRepository.resolveIssue(
      issueId,
      adminUserId,
      dto.decision,
      dto.resolutionNote,
    );
    const booking = await this.bookingsRepository.cancelBookingAfterIssueRefund(
      bookingId,
      adminUserId,
      dto.resolutionNote ?? 'Admin resolved booking issue with full refund',
    );

    await this.notificationsService.createNotification({
      userId: issue.booking.customerId,
      actorUserId: adminUserId,
      type: 'BOOKING',
      title: 'Booking issue resolved',
      message:
        'Your booking issue was reviewed. A full refund has been started.',
      bookingId,
      actionUrl: `/api/v1/bookings/${bookingId}/tracking`,
    });

    await this.notificationsService.notifyVendorBookingUpdate(
      adminUserId,
      booking,
      'Booking issue resolved with refund',
    );

    return {
      message: 'Issue resolved and full refund started',
      decision: dto.decision,
      issue: this.presentIssue(resolved),
      booking,
      payment: refundResult,
    };
  }

  async vendorAcceptBooking(
    userId: string,
    bookingId: string,
    dto: VendorBookingDecisionDto,
  ) {
    const booking = await this.ensureVendorBooking(userId, bookingId);

    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Only pending bookings can be accepted');
    }

    await this.ensureNoOverlap(
      booking.foodTruckId,
      booking.startsAt,
      booking.endsAt!,
    );

    const updatedBooking = await this.bookingsRepository.updateBookingStatus(
      bookingId,
      booking.status,
      'ACCEPTED',
      userId,
      dto.reason,
      { acceptedAt: new Date() },
    );

    await this.notificationsService.notifyCustomerBookingUpdate(
      userId,
      updatedBooking,
      'Booking accepted',
      NotificationEventType.BOOKING_ACCEPTED,
    );

    await this.rewardsService.awardPoints(
      booking.customerId,
      'BOOKING',
      booking.id,
      {
        idempotencyKey: `BOOKING:${booking.customerId}:${booking.id}`,
        description: 'Booking reward',
      },
    );

    return updatedBooking;
  }

  async vendorRejectBooking(
    userId: string,
    bookingId: string,
    dto: VendorBookingDecisionDto,
  ) {
    const booking = await this.ensureVendorBooking(userId, bookingId);

    if (!['PENDING', 'ACCEPTED', 'QUOTED'].includes(booking.status)) {
      throw new BadRequestException(
        'Booking cannot be rejected in this status',
      );
    }

    const updatedBooking = await this.bookingsRepository.updateBookingStatus(
      bookingId,
      booking.status,
      'REJECTED',
      userId,
      dto.reason,
      { cancellationReason: dto.reason },
    );

    await this.notificationsService.notifyCustomerBookingUpdate(
      userId,
      updatedBooking,
      'Booking rejected',
      NotificationEventType.BOOKING_REJECTED,
    );

    return updatedBooking;
  }

  async createVendorQuote(
    userId: string,
    bookingId: string,
    dto: CreateBookingQuoteDto,
  ) {
    const booking = await this.ensureVendorBooking(userId, bookingId);
    const vendor = await this.ensureVendor(userId);

    if (!['PENDING', 'ACCEPTED'].includes(booking.status)) {
      throw new BadRequestException('Booking is not ready for a quote');
    }

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('Quote expiresAt must be in the future');
    }

    if (
      dto.subtotal !== undefined &&
      dto.baseServiceFee !== undefined &&
      dto.subtotal !== dto.baseServiceFee
    )
      throw new BadRequestException('subtotal and baseServiceFee must match');
    if (
      dto.transportFee !== undefined &&
      dto.outsideRadiusFee !== undefined &&
      dto.transportFee !== dto.outsideRadiusFee
    )
      throw new BadRequestException(
        'transportFee and outsideRadiusFee must match',
      );
    const calculated = calculateQuote(
      {
        ...dto,
        baseServiceFee: dto.baseServiceFee ?? dto.subtotal,
        transportFee: dto.transportFee ?? dto.outsideRadiusFee,
        quotedAmount: dto.totalAmount,
      },
      booking.guestCount,
    );
    Object.assign(dto, calculated, {
      subtotal: calculated.baseServiceFee,
      totalAmount: calculated.quotedAmount,
      outsideRadiusFee: calculated.transportFee,
    });

    const subtotal = calculated.baseServiceFee;
    const transportFee = calculated.transportFee;
    const totalAmount = calculated.quotedAmount;
    const paymentPreference = dto.paymentPreference!;

    await this.ensureNoOverlap(
      booking.foodTruckId,
      booking.startsAt,
      booking.endsAt!,
    );

    const quoteResult = await this.bookingsRepository.createQuote(
      bookingId,
      vendor.id,
      userId,
      booking.status,
      {
        ...dto,
        subtotal,
        outsideRadiusFee: transportFee,
        transportFee,
        totalAmount,
        paymentPreference,
      },
    );

    await this.notificationsService.notifyCustomerBookingUpdate(
      userId,
      quoteResult.booking,
      'New booking quote',
      NotificationEventType.QUOTE_CREATED,
    );

    return {
      ...quoteResult,
      message: 'Quote sent successfully',
      breakdown: calculated,
    };
  }

  async customerAcceptQuote(
    userId: string,
    quoteId: string,
    dto: AcceptBookingQuoteDto,
  ) {
    const quote = await this.bookingsRepository.findQuoteById(quoteId);

    if (!quote) {
      throw new NotFoundException('Booking quote not found');
    }

    if (quote.booking.customerId !== userId) {
      throw new ForbiddenException('Quote does not belong to this customer');
    }

    if (quote.status !== 'PENDING') {
      throw new BadRequestException('Quote is not pending');
    }

    if (quote.expiresAt && quote.expiresAt <= new Date()) {
      throw new BadRequestException('Quote has expired');
    }

    if (quote.booking.status !== 'QUOTED') {
      throw new BadRequestException(
        'Booking is not ready for quote acceptance',
      );
    }

    await this.ensureNoOverlap(
      quote.booking.foodTruckId,
      quote.booking.startsAt,
      quote.booking.endsAt!,
    );

    const booking = await this.bookingsRepository.acceptQuote(
      quoteId,
      userId,
      dto,
    );

    await this.rewardsService.awardPoints(userId, 'BOOKING', booking!.id, {
      idempotencyKey: `BOOKING:${userId}:${booking!.id}`,
      description: 'Booking reward',
    });
    await this.notificationsService.notifyVendorBookingUpdate(
      userId,
      booking!,
      'Quote accepted',
    );

    return booking;
  }

  private async ensureBookingVisible(
    user: AuthenticatedUser,
    bookingId: string,
  ) {
    const booking =
      await this.bookingsRepository.findBookingForTracking(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId === user.sub) {
      return { booking, roleView: 'CUSTOMER' as const };
    }

    if (user.roles.includes(UserRole.ADMIN)) {
      return { booking, roleView: 'ADMIN' as const };
    }

    const vendor = await this.ensureVendor(user.sub);

    if (booking.vendorId !== vendor.id) {
      throw new ForbiddenException('Booking is not visible to this user');
    }

    return { booking, roleView: 'VENDOR' as const };
  }

  private async ensureIssueVisible(
    user: AuthenticatedUser,
    bookingId: string,
    issueId: string,
  ) {
    const issue = await this.bookingsRepository.findIssueForBooking(
      bookingId,
      issueId,
    );

    if (!issue) {
      throw new NotFoundException('Booking issue not found');
    }

    if (user.roles.includes(UserRole.ADMIN)) {
      return { issue, senderRole: 'ADMIN' as const };
    }

    if (issue.booking.customerId === user.sub) {
      return { issue, senderRole: 'CUSTOMER' as const };
    }

    const vendor = await this.ensureVendor(user.sub);

    if (issue.booking.vendorId !== vendor.id) {
      throw new ForbiddenException('Booking issue is not visible to this user');
    }

    return { issue, senderRole: 'VENDOR' as const };
  }

  private presentTracking(
    booking: Awaited<ReturnType<BookingsRepository['findBookingForTracking']>>,
    roleView: 'CUSTOMER' | 'VENDOR' | 'ADMIN',
  ) {
    const now = new Date();
    const payment = booking!.payments.find(
      (item) => item.status === 'SUCCEEDED',
    );
    const depositDone = Boolean(payment);
    const confirmedDone = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(
      booking!.status,
    );
    const eventStarted = booking!.startsAt <= now;
    const completionRequested = Boolean(booking!.completionRequestedAt);
    const completed =
      booking!.status === 'COMPLETED' || Boolean(booking!.completedAt);
    const paymentReleased = Boolean(booking!.paymentReleasedAt);

    const step = (
      key: string,
      label: string,
      done: boolean,
      current: boolean,
      completedAt?: Date | null,
    ) => ({
      key,
      label,
      status: done ? 'DONE' : current ? 'CURRENT' : 'PENDING',
      completedAt: completedAt?.toISOString() ?? null,
    });

    const eventDone = completionRequested || completed;
    const eventCurrent = eventStarted && !eventDone;

    const customerSteps = [
      step(
        'BOOKING_CONFIRMED',
        'Booking confirmed',
        confirmedDone,
        !confirmedDone,
        booking!.confirmedAt,
      ),
      step(
        'DEPOSIT',
        'Deposit',
        depositDone,
        confirmedDone && !depositDone,
        payment?.paidAt,
      ),
      step('EVENT_DAY', 'Event day', eventDone, eventCurrent, null),
      step(
        'REQUEST_PENDING',
        'Request Pending',
        completed,
        completionRequested && !completed,
        booking!.completionRequestedAt,
      ),
      step(
        'PAYMENT_RELEASED',
        'Payment released',
        paymentReleased,
        completed && !paymentReleased,
        booking!.paymentReleasedAt,
      ),
    ];

    const vendorSteps = [
      step(
        'BOOKING_CONFIRMED',
        'Booking confirmed',
        confirmedDone,
        !confirmedDone,
        booking!.confirmedAt,
      ),
      step(
        'DEPOSIT',
        'Deposit',
        depositDone,
        confirmedDone && !depositDone,
        payment?.paidAt,
      ),
      step('EVENT_DAY', 'Event day', eventDone, eventCurrent, null),
      step(
        'COMPLETION_REQUEST_SENT',
        'Completion request sent',
        completed,
        completionRequested && !completed,
        booking!.completionRequestedAt,
      ),
      step('COMPLETED', 'Completed', completed, false, booking!.completedAt),
    ];

    const steps = roleView === 'VENDOR' ? vendorSteps : customerSteps;

    return {
      bookingId: booking!.id,
      bookingNumber: booking!.bookingNumber,
      roleView,
      currentStep:
        steps.find((item) => item.status === 'CURRENT')?.key ??
        [...steps].reverse().find((item) => item.status === 'DONE')?.key ??
        steps[0].key,
      completion: {
        requestedAt: booking!.completionRequestedAt?.toISOString() ?? null,
        approvedAt: booking!.completionApprovedAt?.toISOString() ?? null,
        paymentReleasedAt: booking!.paymentReleasedAt?.toISOString() ?? null,
        hasOpenIssue: Boolean(booking!.issues.length),
      },
      steps,
    };
  }

  private presentIssue(issue: any) {
    return {
      id: issue.id,
      bookingId: issue.bookingId,
      status: issue.status,
      message: issue.message,
      resolutionDecision: issue.resolutionDecision ?? null,
      resolutionNote: issue.resolutionNote ?? null,
      resolvedById: issue.resolvedById ?? null,
      createdAt: issue.createdAt,
      resolvedAt: issue.resolvedAt ?? null,
    };
  }

  private presentIssueMessage(message: any) {
    const profile = message.sender?.profile;
    const displayName =
      profile?.displayName ||
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
      message.sender?.vendor?.businessName ||
      message.sender?.email ||
      message.senderRole;

    return {
      id: message.id,
      senderRole: message.senderRole,
      senderName: displayName || message.senderRole,
      message: message.message,
      createdAt: message.createdAt,
    };
  }

  private validateBookingWindow(startsAt: Date, endsAt: Date) {
    if (startsAt <= new Date()) {
      throw new BadRequestException('Booking startsAt must be in the future');
    }

    if (startsAt >= endsAt) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }

  private validateBookingConfirmations(dto: CreateBookingDto) {
    if (dto.isAdultConfirmed !== true) {
      throw new BadRequestException(
        'You must confirm that you are 18 years or older',
      );
    }

    if (dto.termsAccepted !== true) {
      throw new BadRequestException(
        'You must agree to the BiteDrop Terms and Conditions',
      );
    }
  }

  private normalizeCustomMenuItems(items?: string[]) {
    if (!items?.length) {
      return undefined;
    }

    const normalizedItems = items.map((item) => item.trim()).filter(Boolean);

    if (normalizedItems.length !== items.length) {
      throw new BadRequestException('Custom menu items cannot be empty');
    }

    return [...new Set(normalizedItems)];
  }

  private async validateServiceArea(
    foodTruckId: string,
    dto: CreateBookingDto,
  ) {
    const rows = await this.bookingsRepository.checkServiceArea(
      foodTruckId,
      dto,
    );
    const serviceArea = rows[0];

    if (!serviceArea) {
      throw new BadRequestException('Food truck has no active service area');
    }

    const distanceKm = Number(serviceArea.distanceKm);
    const radiusKm = Number(serviceArea.radiusKm);
    const outsideRadiusFee = Number(serviceArea.outsideRadiusFee ?? 0);
    const outsideServiceRadius = distanceKm > radiusKm;

    if (outsideServiceRadius && !serviceArea.outsideRadiusAllowed) {
      throw new BadRequestException(
        'Booking address is outside service radius',
      );
    }

    return {
      distanceKm,
      outsideServiceRadius,
      outsideRadiusFee: outsideServiceRadius ? outsideRadiusFee : 0,
    };
  }

  private async validatePreferredMenuItems(
    foodTruckId: string,
    preferredMenuItemIds?: string[],
  ) {
    if (!preferredMenuItemIds?.length) {
      return;
    }

    const uniqueItemIds = [...new Set(preferredMenuItemIds)];
    const count = await this.bookingsRepository.countMenuItemsForFoodTruck(
      foodTruckId,
      uniqueItemIds,
    );

    if (count !== uniqueItemIds.length) {
      throw new BadRequestException(
        'One or more preferred menu items do not belong to this food truck',
      );
    }
  }

  private async ensureNoOverlap(
    foodTruckId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const hasOverlap = await this.bookingsRepository.hasOverlap(
      foodTruckId,
      startsAt,
      endsAt,
    );

    if (hasOverlap) {
      throw new ConflictException(
        'Food truck already has a booking or hold in this window',
      );
    }
  }

  private async ensureVendor(userId: string) {
    const vendor = await this.bookingsRepository.findVendorForActor(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    return vendor;
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck =
      await this.bookingsRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (
      foodTruck.vendor.deletedAt ||
      foodTruck.vendor.status !== 'APPROVED' ||
      !foodTruck.vendor.isVerified
    ) {
      throw new ForbiddenException('Food truck is not available for booking');
    }

    return foodTruck;
  }

  private async ensureVendorBooking(userId: string, bookingId: string) {
    const vendor = await this.ensureVendor(userId);
    const booking = await this.bookingsRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.vendorId !== vendor.id) {
      throw new ForbiddenException('Booking does not belong to this vendor');
    }

    if (!booking.endsAt) {
      throw new BadRequestException('Booking end time is required');
    }

    return booking;
  }
}
