import { VendorVerificationDocumentType } from './enums/vendor-verification-document-type.enum';

export const VENDOR_DOCUMENT_SUBMISSION_CONFIRMATION =
  'Thank you for submitting your documents. Our team will review and get back to you shortly.';

export const TEXAS_STATES = new Set(['TX', 'TEXAS']);

export const TEXAS_VENDOR_DOCUMENT_REQUIREMENTS = [
  {
    type: VendorVerificationDocumentType.DSHS_MOBILE_FOOD_VENDOR_LICENSE,
    label: 'Department of State Health Services (DSHS) Mobile Food Vendor License',
  },
  {
    type: VendorVerificationDocumentType.FOOD_MANAGER_CERTIFICATION,
    label: 'Food Manager Certification',
  },
  {
    type: VendorVerificationDocumentType.CERTIFICATE_OF_INSURANCE,
    label: 'Certificate of Insurance (COI)',
  },
] as const;

export const NON_TEXAS_VENDOR_DOCUMENT_REQUIREMENTS = [
  {
    type: VendorVerificationDocumentType.STATE_OR_LOCAL_FOOD_VENDOR_PERMIT,
    label: 'State/local food vendor permit',
  },
  {
    type: VendorVerificationDocumentType.FOOD_MANAGER_CERTIFICATION,
    label: 'Food Manager Certification',
  },
  {
    type: VendorVerificationDocumentType.CERTIFICATE_OF_INSURANCE,
    label: 'Certificate of Insurance (COI)',
  },
] as const;
