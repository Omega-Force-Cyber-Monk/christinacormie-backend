# BiteDrop — Two Booking Flows & Payment Commission Architecture

This document formalizes the two distinct booking workflows and the automated deposit-to-commission payment logic.

---

## 1. Flow 1: Public Community Request (Marketplace Bidding)

```text
[ Customer Creates Event Request in Community Feed ]
                     │
                     ▼
[ Multiple Vendors Browse & Send Custom Quotes ]
  • Pricing Model: Flat fee vs Per person
  • Menus selected
  • Base Service Fee + Extra Charges (Transport/Travel)
  • Payment Terms: Deposit Only vs Prepaid in Full
                     │
                     ▼
[ Customer Reviews Received Quotes (Sorted by Price/Rating/Recent) ]
                     │
                     ▼
[ Customer Accepts Quote & Pays Deposit / Full Amount ]
  • Option to apply available BiteDrop Credit (e.g. -$10.00)
  • Enters Card / Selects Saved Card
                     │
                     ▼
[ Booking Confirmed & Real-Time Split via Stripe ]
```

---

## 2. Flow 2: Direct Food Truck Profile Booking

```text
[ Customer Visits Specific Food Truck Profile (@tacoparadise) ]
                     │
                     ▼
[ Clicks "Book" Button -> Completes 5-Step Event Wizard ]
  1. Event Type (Birthday, Corporate, Wedding, etc.)
  2. Logistics (Date, Time, Exact Address/GPS, Guests, Budget)
  3. Menu Preferences (Tags)
  4. Payment Model Preference (Deposit vs Full)
  5. Special Instructions & Consents
                     │
                     ▼
[ Direct Request Sent Exclusively to that Vendor ]
                     │
                     ▼
[ Vendor Submits Quote -> Customer Accepts & Pays -> Confirmed ]
```

---

## 3. Financial Split & Deposit Validation Rules

### A. The Minimum Deposit Rule
* **Platform Commission**: Fixed platform fee (e.g., **20%** or 15%).
* **Validation Rule**: When a vendor creates a quote with **"Deposit only"**, the deposit percentage **MUST be greater than or equal to the platform commission rate ($\ge 20\%$)**.
* **Reason**: This guarantees that the upfront deposit collected by the platform is sufficient to cover the platform's 20% commission, ensuring zero collection risk from the vendor later.

### B. Payment Split Example ($1,000 Total Quote with 20% Commission)

#### Scenario 1: Deposit Only (e.g., 25% Deposit = $250)
* **Total Quote**: $1,000.00
* **Platform Commission (20%)**: $200.00
* **Customer Pays Upfront at Booking**: $250.00
* **Stripe Split Execution**:
  * **Platform Main Stripe Account**: Receives **$200.00** (100% of platform commission).
  * **Vendor Connected Stripe Account**: Receives **$50.00** (remainder of the upfront deposit).
* **Balance Due at Event Day**: **$750.00** (paid directly by customer to vendor at the event).

#### Scenario 2: Prepaid in Full ($1,000 Upfront)
* **Customer Pays Upfront**: $1,000.00
* **Platform Main Stripe Account**: Receives **$200.00** (20% platform commission).
* **Vendor Connected Stripe Account**: Receives **$800.00** (80% net vendor earnings).
* **Balance Due at Event**: **$0.00**.
